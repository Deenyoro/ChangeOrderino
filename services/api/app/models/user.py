"""User model"""
from sqlalchemy import Column, String, Boolean, Enum as SQLEnum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    """User roles"""
    admin = "admin"
    foreman = "foreman"
    project_manager = "project_manager"
    office_staff = "office_staff"
    viewer = "viewer"  # Legacy role - kept for backward compatibility


class User(Base):
    """User model"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    keycloak_id = Column(String(255), unique=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False)
    full_name = Column(String(255))
    role = Column(
        SQLEnum(UserRole, name='user_role'),
        nullable=False,
        default=UserRole.foreman
    )
    is_active = Column(Boolean, default=True)
    extra_metadata = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<User {self.username} ({self.email})>"
