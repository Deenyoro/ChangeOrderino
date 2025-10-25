"""Equipment Item model"""
from sqlalchemy import Column, String, Text, Numeric, Integer, DateTime, func, ForeignKey, Computed
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class EquipmentItem(Base):
    """Equipment line item model"""
    __tablename__ = "equipment_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tnm_ticket_id = Column(UUID(as_uuid=True), ForeignKey("tnm_tickets.id", ondelete="CASCADE"), nullable=False, index=True)

    description = Column(Text, nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)
    unit = Column(String(50))
    unit_price = Column(Numeric(12, 2), nullable=False)

    # Calculated column
    subtotal = Column(Numeric(12, 2), Computed("quantity * unit_price"))

    line_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    tnm_ticket = relationship("TNMTicket", back_populates="equipment_items")

    def __repr__(self):
        return f"<EquipmentItem {self.description}: {self.quantity} {self.unit} @ ${self.unit_price}>"
