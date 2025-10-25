"""Line Item Approval model"""
from sqlalchemy import Column, String, Text, Numeric, DateTime, func, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum

from app.core.database import Base


class ApprovalStatus(str, enum.Enum):
    """Approval status"""
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"


class LineItemApproval(Base):
    """Line item approval model (GC can approve/deny individual items)"""
    __tablename__ = "line_item_approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tnm_ticket_id = Column(UUID(as_uuid=True), ForeignKey("tnm_tickets.id", ondelete="CASCADE"), nullable=False, index=True)

    line_item_type = Column(String(50), nullable=False)  # 'labor', 'material', 'equipment', 'subcontractor'
    line_item_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    status = Column(
        SQLEnum(ApprovalStatus, name='approval_status', values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ApprovalStatus.PENDING
    )
    approved_amount = Column(Numeric(12, 2))
    gc_comment = Column(Text)

    approved_at = Column(DateTime(timezone=True))
    approved_by = Column(String(255))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    tnm_ticket = relationship("TNMTicket", back_populates="approvals")

    def __repr__(self):
        return f"<LineItemApproval {self.line_item_type} {self.line_item_id}: {self.status}>"
