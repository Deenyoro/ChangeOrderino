"""TNM Ticket model"""
from sqlalchemy import Column, String, Text, Numeric, Integer, Date, DateTime, Boolean, func, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.orm import relationship
import uuid
import enum

from app.core.database import Base


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
    paid = "paid"


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

    # Submitter (Foreman)
    submitter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    submitter_name = Column(String(255), nullable=False)
    submitter_email = Column(String(255), nullable=False)

    # Dates
    proposal_date = Column(Date, nullable=False)
    response_date = Column(Date)
    due_date = Column(Date, nullable=True)  # Optional due date for response

    # Status
    status = Column(
        SQLEnum(TNMStatus, name='tnm_status'),
        nullable=False,
        default=TNMStatus.draft,
        index=True
    )

    # OH&P override percentages (nullable = use project/global defaults if NULL)
    material_ohp_percent = Column(Numeric(5, 2), nullable=True)
    labor_ohp_percent = Column(Numeric(5, 2), nullable=True)
    equipment_ohp_percent = Column(Numeric(5, 2), nullable=True)
    subcontractor_ohp_percent = Column(Numeric(5, 2), nullable=True)

    # Labor rate overrides (nullable = use project/global defaults if NULL)
    rate_project_manager = Column(Numeric(8, 2), nullable=True)
    rate_superintendent = Column(Numeric(8, 2), nullable=True)
    rate_carpenter = Column(Numeric(8, 2), nullable=True)
    rate_laborer = Column(Numeric(8, 2), nullable=True)

    # Calculated totals
    labor_subtotal = Column(Numeric(12, 2), default=0.00)
    labor_total = Column(Numeric(12, 2), default=0.00)
    total_labor_hours = Column(Numeric(10, 2), default=0.00)

    material_subtotal = Column(Numeric(12, 2), default=0.00)
    material_total = Column(Numeric(12, 2), default=0.00)

    equipment_subtotal = Column(Numeric(12, 2), default=0.00)
    equipment_total = Column(Numeric(12, 2), default=0.00)

    subcontractor_subtotal = Column(Numeric(12, 2), default=0.00)
    subcontractor_total = Column(Numeric(12, 2), default=0.00)

    proposal_amount = Column(Numeric(12, 2), default=0.00)
    approved_amount = Column(Numeric(12, 2), default=0.00)

    # Attachments
    signature_url = Column(Text)  # Submitter/foreman signature
    photo_urls = Column(ARRAY(Text))

    # Approval signature
    gc_signature_url = Column(Text)  # GC approval signature

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
    is_paid = Column(Integer, default=0, nullable=False, index=True)  # 0 = not paid, 1 = paid
    paid_date = Column(DateTime(timezone=True))
    paid_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    notes = Column(Text)
    extra_metadata = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="tnm_tickets")
    labor_items = relationship("LaborItem", back_populates="tnm_ticket", cascade="all, delete-orphan")
    material_items = relationship("MaterialItem", back_populates="tnm_ticket", cascade="all, delete-orphan")
    equipment_items = relationship("EquipmentItem", back_populates="tnm_ticket", cascade="all, delete-orphan")
    subcontractor_items = relationship("SubcontractorItem", back_populates="tnm_ticket", cascade="all, delete-orphan")
    approvals = relationship("LineItemApproval", back_populates="tnm_ticket", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="tnm_ticket", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<TNMTicket {self.tnm_number}: {self.title}>"

    def calculate_totals(self):
        """Calculate all totals with OH&P"""
        # Labor
        self.labor_total = self.labor_subtotal * (1 + (self.labor_ohp_percent / 100))

        # Material
        self.material_total = self.material_subtotal * (1 + (self.material_ohp_percent / 100))

        # Equipment
        self.equipment_total = self.equipment_subtotal * (1 + (self.equipment_ohp_percent / 100))

        # Subcontractor
        self.subcontractor_total = self.subcontractor_subtotal * (1 + (self.subcontractor_ohp_percent / 100))

        # Total proposal amount
        self.proposal_amount = (
            self.labor_total +
            self.material_total +
            self.equipment_total +
            self.subcontractor_total
        )
