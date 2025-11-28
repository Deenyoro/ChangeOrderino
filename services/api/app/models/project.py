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
    pm_email = Column(String(255))  # Project Manager email for approvals

    # Default OH&P percentages (nullable = use global defaults if NULL)
    material_ohp_percent = Column(Numeric(5, 2), nullable=True)
    labor_ohp_percent = Column(Numeric(5, 2), nullable=True)
    equipment_ohp_percent = Column(Numeric(5, 2), nullable=True)
    subcontractor_ohp_percent = Column(Numeric(5, 2), nullable=True)

    # Labor rate overrides (nullable = use global defaults if NULL)
    rate_project_manager = Column(Numeric(8, 2), nullable=True)
    rate_superintendent = Column(Numeric(8, 2), nullable=True)
    rate_carpenter = Column(Numeric(8, 2), nullable=True)
    rate_laborer = Column(Numeric(8, 2), nullable=True)

    # Reminder settings (nullable = use global defaults if NULL)
    reminder_interval_days = Column(Integer, nullable=True)
    reminder_max_retries = Column(Integer, nullable=True)

    # Approval token expiration override (nullable = use global default if NULL)
    approval_token_expiration_hours = Column(Integer, nullable=True)

    is_active = Column(Boolean, default=True, index=True)
    notes = Column(Text)
    extra_metadata = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    tnm_tickets = relationship("TNMTicket", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project {self.project_number}: {self.name}>"
