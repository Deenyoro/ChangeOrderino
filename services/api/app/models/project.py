"""Project model"""
from sqlalchemy import Column, String, Boolean, Numeric, Integer, Text, DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class Project(Base):
    """Project/Job model"""
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    project_number = Column(String(100), unique=True, nullable=False, index=True)

    customer_company = Column(String(255))
    gc_company = Column(String(255))
    gc_email = Column(String(255))
    gc_contact_name = Column(String(255))
    gc_phone = Column(String(50))

    # Project Manager
    project_manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    project_manager_name = Column(String(255))

    # Default OH&P percentages
    material_ohp_percent = Column(Numeric(5, 2), default=15.00)
    labor_ohp_percent = Column(Numeric(5, 2), default=20.00)
    equipment_ohp_percent = Column(Numeric(5, 2), default=10.00)
    subcontractor_ohp_percent = Column(Numeric(5, 2), default=5.00)

    # Reminder settings
    reminder_interval_days = Column(Integer, default=7)
    reminder_max_retries = Column(Integer, default=4)

    is_active = Column(Boolean, default=True, index=True)
    notes = Column(Text)
    extra_metadata = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    tnm_tickets = relationship("TNMTicket", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project {self.project_number}: {self.name}>"
