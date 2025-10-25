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

from app.core.config import settings


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


def require_roles(required_roles: list[str]):
    """
    Dependency factory for role-based access control
    Usage: user: TokenData = Depends(require_roles(["admin"]))
    """
    async def _require_roles(current_user: TokenData = Depends(get_current_user)) -> TokenData:
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
