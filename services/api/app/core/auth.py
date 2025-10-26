"""
Authentication and authorization using Keycloak
"""
from typing import Optional
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db


# Security scheme
security = HTTPBearer(auto_error=False)


class TokenData(BaseModel):
    """Decoded JWT token data"""
    sub: str  # User ID (Keycloak subject)
    email: Optional[str] = None
    preferred_username: Optional[str] = None
    name: Optional[str] = None
    roles: list[str] = []
    exp: Optional[int] = None


class KeycloakClient:
    """Keycloak client for token validation"""

    _jwks_cache: Optional[dict] = None
    _jwks_cache_time: Optional[datetime] = None

    @classmethod
    async def get_jwks(cls) -> dict:
        """
        Get Keycloak JWKS for JWT validation
        Cached for 1 hour
        """
        if cls._jwks_cache and cls._jwks_cache_time:
            if datetime.now() - cls._jwks_cache_time < timedelta(hours=1):
                return cls._jwks_cache

        # Fetch JWKS from Keycloak
        url = f"{settings.KEYCLOAK_REALM_URL}/protocol/openid-connect/certs"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            cls._jwks_cache = response.json()
            cls._jwks_cache_time = datetime.now()
            return cls._jwks_cache

    @classmethod
    async def validate_token(cls, token: str) -> TokenData:
        """Validate JWT token and return token data"""
        try:
            # Get JWKS
            jwks = await cls.get_jwks()

            # Get token header to find the key ID
            unverified_header = jwt.get_unverified_header(token)

            # Find the right key from JWKS
            key = None
            for jwk_key in jwks.get("keys", []):
                if jwk_key.get("kid") == unverified_header.get("kid"):
                    key = jwk_key
                    break

            if not key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unable to find appropriate key in JWKS"
                )

            # Decode and validate token using the JWK directly
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=settings.KEYCLOAK_CLIENT_ID,
                options={"verify_aud": False}  # Keycloak doesn't always set aud for public clients
            )

            # Extract roles from the "roles" claim (we configured a mapper for this)
            roles = payload.get("roles", [])

            # Fallback to realm_access or resource_access if roles claim not found
            if not roles:
                if "realm_access" in payload:
                    roles.extend(payload["realm_access"].get("roles", []))
                if "resource_access" in payload and settings.KEYCLOAK_CLIENT_ID in payload["resource_access"]:
                    roles.extend(
                        payload["resource_access"][settings.KEYCLOAK_CLIENT_ID].get("roles", [])
                    )

            # Auto-assign default "foreman" role to any authenticated user without specific roles
            # This allows all TRE employees to create TNM forms without manual role assignment
            if not roles:
                roles = ["foreman"]

            return TokenData(
                sub=payload.get("sub"),
                email=payload.get("email"),
                preferred_username=payload.get("preferred_username"),
                name=payload.get("name"),
                roles=roles,
                exp=payload.get("exp"),
            )

        except JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid authentication credentials: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> TokenData:
    """
    FastAPI dependency to get current authenticated user
    Usage: user: TokenData = Depends(get_current_user)
    """
    # If auth is disabled, return mock admin user
    if not settings.AUTH_ENABLED:
        return TokenData(
            sub="00000000-0000-0000-0000-000000000001",
            email="admin@treconstruction.net",
            preferred_username="admin",
            name="System Administrator",
            roles=["admin"],
        )

    # Auth is enabled, validate token
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    return await KeycloakClient.validate_token(token)


async def get_current_active_user(
    current_user: TokenData = Depends(get_current_user),
) -> TokenData:
    """Get current active user (additional validation)"""
    return current_user


async def sync_user_to_db(
    token_data: TokenData,
    db: AsyncSession,
) -> None:
    """
    Sync Keycloak user to local database
    Creates user if doesn't exist, updates if changed

    Note: Uses flush() instead of commit() to keep in same transaction
    """
    from uuid import UUID
    from sqlalchemy import select
    from app.models.user import User, UserRole
    import logging

    logger = logging.getLogger(__name__)

    # Skip if mock user (auth disabled)
    if token_data.sub == "00000000-0000-0000-0000-000000000001":
        # Ensure mock admin user exists in database
        result = await db.execute(
            select(User).where(User.id == UUID("00000000-0000-0000-0000-000000000001"))
        )
        mock_user = result.scalar_one_or_none()

        if not mock_user:
            mock_user = User(
                id=UUID("00000000-0000-0000-0000-000000000001"),
                keycloak_id="00000000-0000-0000-0000-000000000001",
                email="admin@treconstruction.net",
                username="admin",
                full_name="System Administrator",
                role=UserRole.admin,
                is_active=True
            )
            db.add(mock_user)
            await db.flush()  # Use flush instead of commit
            logger.info("Created mock admin user")

        return

    try:
        user_id = UUID(token_data.sub)
    except (ValueError, AttributeError) as e:
        logger.warning(f"Invalid user ID in token: {token_data.sub}, error: {e}")
        return

    # Try to find existing user by ID or keycloak_id
    result = await db.execute(
        select(User).where(
            (User.id == user_id) | (User.keycloak_id == token_data.sub)
        )
    )
    user = result.scalar_one_or_none()

    if user:
        # Update user info if changed (but be careful about unique constraints)
        updated = False

        # Only update email if it's different AND won't cause a conflict
        if token_data.email and user.email != token_data.email:
            # Check if new email is already taken by another user
            result = await db.execute(
                select(User).where(
                    (User.email == token_data.email) & (User.id != user_id)
                )
            )
            email_conflict = result.scalar_one_or_none()
            if not email_conflict:
                user.email = token_data.email
                updated = True
            else:
                logger.warning(f"Cannot update user {user_id} email to {token_data.email} - already taken by another user")

        # Only update username if it's different AND won't cause a conflict
        if token_data.preferred_username and user.username != token_data.preferred_username:
            # Check if new username is already taken by another user
            result = await db.execute(
                select(User).where(
                    (User.username == token_data.preferred_username) & (User.id != user_id)
                )
            )
            username_conflict = result.scalar_one_or_none()
            if not username_conflict:
                user.username = token_data.preferred_username
                updated = True
            else:
                logger.warning(f"Cannot update user {user_id} username to {token_data.preferred_username} - already taken by another user")

        if token_data.name and user.full_name != token_data.name:
            user.full_name = token_data.name
            updated = True

        if updated:
            await db.flush()  # Use flush instead of commit
            logger.info(f"Updated user {user_id}")
    else:
        # Create new user
        # Map Keycloak roles to our user roles
        role = UserRole.foreman  # Default role
        if "admin" in token_data.roles:
            role = UserRole.admin
        elif "project_manager" in token_data.roles:
            role = UserRole.project_manager
        elif "office_staff" in token_data.roles:
            role = UserRole.office_staff
        elif "foreman" in token_data.roles:
            role = UserRole.foreman

        # Generate email - check if it already exists and make it unique if needed
        email = token_data.email or f"user_{token_data.sub[:8]}@treconstruction.net"
        username = token_data.preferred_username or f"user_{token_data.sub[:8]}"

        # Check if email already exists
        if token_data.email:
            result = await db.execute(
                select(User).where(User.email == token_data.email)
            )
            existing_email_user = result.scalar_one_or_none()
            if existing_email_user:
                # Email conflict - make it unique by appending user ID prefix
                email = f"{token_data.sub[:8]}_{token_data.email}"
                logger.warning(f"Email {token_data.email} already exists, using {email} instead")

        # Check if username already exists
        if token_data.preferred_username:
            result = await db.execute(
                select(User).where(User.username == token_data.preferred_username)
            )
            existing_username_user = result.scalar_one_or_none()
            if existing_username_user:
                # Username conflict - make it unique by appending user ID prefix
                username = f"{token_data.sub[:8]}_{token_data.preferred_username}"
                logger.warning(f"Username {token_data.preferred_username} already exists, using {username} instead")

        new_user = User(
            id=user_id,
            keycloak_id=token_data.sub,
            email=email,
            username=username,
            full_name=token_data.name or token_data.preferred_username or "Unknown User",
            role=role,
            is_active=True
        )

        db.add(new_user)
        await db.flush()  # Use flush to persist in current transaction
        logger.info(f"Created new user {user_id} ({new_user.email})")


async def get_current_user_synced(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> TokenData:
    """
    FastAPI dependency to get current authenticated user and sync to database
    This ensures all authenticated users exist in the local users table for audit logging
    Usage: user: TokenData = Depends(get_current_user_synced)
    """
    # Get token data
    token_data = await get_current_user(credentials)

    # Sync to database
    await sync_user_to_db(token_data, db)

    return token_data


def require_roles(required_roles: list[str]):
    """
    Dependency factory for role-based access control
    Usage: user: TokenData = Depends(require_roles(["admin"]))
    """
    async def _require_roles(
        current_user: TokenData = Depends(get_current_user_synced),
    ) -> TokenData:
        user_roles = set(current_user.roles)
        required = set(required_roles)

        if not user_roles.intersection(required):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {required_roles}",
            )

        return current_user

    return _require_roles


def create_approval_token(tnm_ticket_id: str) -> tuple[str, datetime]:
    """
    Create a secure token for GC approval links (non-Keycloak JWT)
    Returns: (token, expiration_datetime)
    """
    expiration = datetime.utcnow() + timedelta(hours=settings.APPROVAL_TOKEN_EXPIRATION_HOURS)

    payload = {
        "tnm_ticket_id": tnm_ticket_id,
        "exp": expiration,
        "type": "approval",
    }

    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expiration


def verify_approval_token(token: str) -> str:
    """
    Verify approval token and return TNM ticket ID
    Raises HTTPException if invalid
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])

        if payload.get("type") != "approval":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token type"
            )

        return payload.get("tnm_ticket_id")

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or expired approval token: {str(e)}"
        )
