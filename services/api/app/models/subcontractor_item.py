"""Subcontractor Item model"""
from sqlalchemy import Column, String, Text, Numeric, Integer, Date, DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class SubcontractorItem(Base):
    """Subcontractor line item model"""
    __tablename__ = "subcontractor_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tnm_ticket_id = Column(UUID(as_uuid=True), ForeignKey("tnm_tickets.id", ondelete="CASCADE"), nullable=False, index=True)

    description = Column(Text, nullable=False)
    subcontractor_name = Column(String(255))
    proposal_date = Column(Date)
    amount = Column(Numeric(12, 2), nullable=False)

    line_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    tnm_ticket = relationship("TNMTicket", back_populates="subcontractor_items")

    def __repr__(self):
        return f"<SubcontractorItem {self.subcontractor_name}: {self.description} - ${self.amount}>"
