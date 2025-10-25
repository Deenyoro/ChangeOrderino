"""User model"""
from sqlalchemy import Column, String, Boolean, Enum as SQLEnum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    """User roles"""
    ADMIN = "admin"
    FOREMAN = "foreman"
    PROJECT_MANAGER = "project_manager"
    OFFICE_STAFF = "office_staff"
    VIEWER = "viewer"  # Legacy role - kept for backward compatibility


class User(Base):
    """User model"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    keycloak_id = Column(String(255), unique=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False)
    full_name = Column(String(255))
    role = Column(
        SQLEnum(UserRole, name='user_role', values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=UserRole.FOREMAN
    )
    is_active = Column(Boolean, default=True)
    extra_metadata = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<User {self.username} ({self.email})>"
