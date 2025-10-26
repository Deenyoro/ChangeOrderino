"""User service for managing user creation and sync"""
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User, UserRole
from app.core.auth import TokenData


class UserService:
    """Service for user management"""

    @staticmethod
    async def get_or_create_user(
        db: AsyncSession,
        token_data: TokenData
    ) -> User:
        """
        Get or create a user from Keycloak token data

        This ensures that authenticated Keycloak users are automatically
        synced to the local database for audit logging and relationships.

        Args:
            db: Database session
            token_data: Decoded Keycloak token data

        Returns:
            User object (existing or newly created)
        """
        user_id = UUID(token_data.sub)

        # Try to find existing user by Keycloak ID
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if user:
            # Update user info if changed
            updated = False
            if token_data.email and user.email != token_data.email:
                user.email = token_data.email
                updated = True
            if token_data.preferred_username and user.username != token_data.preferred_username:
                user.username = token_data.preferred_username
                updated = True
            if token_data.name and user.full_name != token_data.name:
                user.full_name = token_data.name
                updated = True

            if updated:
                await db.commit()
                await db.refresh(user)

            return user

        # User doesn't exist, create new one
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

        new_user = User(
            id=user_id,
            keycloak_id=token_data.sub,
            email=token_data.email or f"user_{token_data.sub}@treconstruction.net",
            username=token_data.preferred_username or token_data.sub,
            full_name=token_data.name or token_data.preferred_username or "Unknown User",
            role=role,
            is_active=True
        )

        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

        return new_user


# Singleton instance
user_service = UserService()
