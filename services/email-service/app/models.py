"""Database models for email service"""
from sqlalchemy import Column, String, Text, Numeric, Integer, Date, DateTime, func, ForeignKey, Enum as SQLEnum, Boolean
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.orm import declarative_base, relationship
import uuid
import enum

Base = declarative_base()


class TNMStatus(str, enum.Enum):
    """TNM Ticket status"""
    draft = "draft"
    pending_review = "pending_review"
    ready_to_send = "ready_to_send"
    sent = "sent"
    viewed = "viewed"
    partially_approved = "partially_approved"
    approved = "approved"
    denied = "denied"
    cancelled = "cancelled"


class Project(Base):
    """Project model"""
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    project_number = Column(String(100), unique=True, nullable=False, index=True)

    customer_company = Column(String(255))
    gc_company = Column(String(255))
    gc_email = Column(String(255))
    gc_contact_name = Column(String(255))
    gc_phone = Column(String(50))

    project_manager_id = Column(UUID(as_uuid=True))
    project_manager_name = Column(String(255))

    material_ohp_percent = Column(Numeric(5, 2), default=15.00)
    labor_ohp_percent = Column(Numeric(5, 2), default=20.00)
    equipment_ohp_percent = Column(Numeric(5, 2), default=10.00)
    subcontractor_ohp_percent = Column(Numeric(5, 2), default=5.00)

    reminder_interval_days = Column(Integer, default=7)
    reminder_max_retries = Column(Integer, default=4)

    is_active = Column(Boolean, default=True, index=True)
    notes = Column(Text)
    extra_metadata = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    tnm_tickets = relationship("TNMTicket", back_populates="project")


class TNMTicket(Base):
    """TNM Ticket (Change Order) model"""
    __tablename__ = "tnm_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tnm_number = Column(String(100), unique=True, nullable=False, index=True)
    rfco_number = Column(String(100))

    # Project reference
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    project_number = Column(String(100), nullable=False)

    # Header info
    title = Column(String(255), nullable=False)
    description = Column(Text)

    # Submitter
    submitter_id = Column(UUID(as_uuid=True))
    submitter_name = Column(String(255), nullable=False)
    submitter_email = Column(String(255), nullable=False)

    # Dates
    proposal_date = Column(Date, nullable=False)
    response_date = Column(Date)
    due_date = Column(Date, nullable=True)

    # Status
    status = Column(SQLEnum(TNMStatus), nullable=False, default=TNMStatus.draft, index=True)

    # Calculated totals
    labor_subtotal = Column(Numeric(12, 2), default=0.00)
    labor_ohp_percent = Column(Numeric(5, 2), default=20.00)
    labor_total = Column(Numeric(12, 2), default=0.00)

    material_subtotal = Column(Numeric(12, 2), default=0.00)
    material_ohp_percent = Column(Numeric(5, 2), default=15.00)
    material_total = Column(Numeric(12, 2), default=0.00)

    equipment_subtotal = Column(Numeric(12, 2), default=0.00)
    equipment_ohp_percent = Column(Numeric(5, 2), default=10.00)
    equipment_total = Column(Numeric(12, 2), default=0.00)

    subcontractor_subtotal = Column(Numeric(12, 2), default=0.00)
    subcontractor_ohp_percent = Column(Numeric(5, 2), default=5.00)
    subcontractor_total = Column(Numeric(12, 2), default=0.00)

    proposal_amount = Column(Numeric(12, 2), default=0.00)
    approved_amount = Column(Numeric(12, 2), default=0.00)

    # Attachments
    signature_url = Column(Text)
    photo_urls = Column(ARRAY(Text))

    # Email tracking
    email_sent_count = Column(Integer, default=0)
    last_email_sent_at = Column(DateTime(timezone=True))
    reminder_count = Column(Integer, default=0)
    last_reminder_sent_at = Column(DateTime(timezone=True))
    send_reminders_until_accepted = Column(Boolean, default=False, nullable=False)
    send_reminders_until_paid = Column(Boolean, default=False, nullable=False)

    # GC approval tracking
    approval_token = Column(String(255), unique=True, index=True)
    approval_token_expires_at = Column(DateTime(timezone=True))
    viewed_at = Column(DateTime(timezone=True))

    # Payment tracking
    is_paid = Column(Integer, default=0, nullable=False, index=True)
    paid_date = Column(DateTime(timezone=True))
    paid_by = Column(UUID(as_uuid=True))

    notes = Column(Text)
    extra_metadata = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="tnm_tickets")


class AppSettings(Base):
    """Global application settings stored in database"""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text)
    data_type = Column(String(50), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

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


class EmailLog(Base):
    """Email log model"""
    __tablename__ = "email_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tnm_ticket_id = Column(UUID(as_uuid=True), ForeignKey("tnm_tickets.id", ondelete="SET NULL"), index=True)

    to_email = Column(String(255), nullable=False)
    from_email = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    body_text = Column(Text)
    body_html = Column(Text)

    email_type = Column(String(50))  # 'initial_send', 'reminder', 'approval_confirmation'

    status = Column(String(50), default='queued', index=True)  # 'queued', 'sent', 'failed', 'bounced'
    error_message = Column(Text)

    sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
