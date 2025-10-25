"""Application Settings model"""
from sqlalchemy import Column, String, Integer, DateTime, func, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base


class AppSettings(Base):
    """Global application settings stored in database

    These settings override .env defaults and can be configured through the UI.
    Database is the source of truth after initial deployment.
    """
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    category = Column(String(100), nullable=False, index=True)  # company, smtp, rates, ohp, reminders, approval
    description = Column(Text)
    data_type = Column(String(50), nullable=False)  # string, integer, float, boolean

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    def __repr__(self):
        return f"<AppSettings {self.key}={self.value}>"

    def get_typed_value(self):
        """Convert string value to appropriate Python type"""
        if self.data_type == "boolean":
            return self.value.lower() in ("true", "1", "yes", "on")
        elif self.data_type == "integer":
            return int(self.value)
        elif self.data_type == "float":
            return float(self.value)
        else:
            return self.value
