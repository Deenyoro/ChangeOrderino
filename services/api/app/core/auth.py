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

    _public_key_cache: Optional[str] = None
    _public_key_cache_time: Optional[datetime] = None

    @classmethod
    async def get_public_key(cls) -> str:
        """
        Get Keycloak public key for JWT validation
        Cached for 1 hour
        """
        if cls._public_key_cache and cls._public_key_cache_time:
            if datetime.now() - cls._public_key_cache_time < timedelta(hours=1):
                return cls._public_key_cache

        # Fetch public key from Keycloak
        url = f"{settings.KEYCLOAK_REALM_URL}/protocol/openid-connect/certs"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            keys = response.json()

            # Get first key (RSA256)
            if keys.get("keys"):
                key_data = keys["keys"][0]
                # Construct PEM format
                cls._public_key_cache = f"""-----BEGIN PUBLIC KEY-----
{key_data.get('x5c', [''])[0]}
-----END PUBLIC KEY-----"""
                cls._public_key_cache_time = datetime.now()
                return cls._public_key_cache

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch Keycloak public key"
        )

    @classmethod
    async def validate_token(cls, token: str) -> TokenData:
        """Validate JWT token and return token data"""
        try:
            public_key = await cls.get_public_key()

            # Decode and validate token
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=settings.KEYCLOAK_CLIENT_ID,
            )

            # Extract roles from realm_access or resource_access
            roles = []
            if "realm_access" in payload:
                roles.extend(payload["realm_access"].get("roles", []))
            if "resource_access" in payload and settings.KEYCLOAK_CLIENT_ID in payload["resource_access"]:
                roles.extend(
                    payload["resource_access"][settings.KEYCLOAK_CLIENT_ID].get("roles", [])
                )

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
