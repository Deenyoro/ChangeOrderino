"""Labor Item model"""
from sqlalchemy import Column, Text, Numeric, Integer, DateTime, func, ForeignKey, Enum as SQLEnum, Computed
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum

from app.core.database import Base


class LaborType(str, enum.Enum):
    """Labor type with associated rates"""
    PROJECT_MANAGER = "project_manager"
    SUPERINTENDENT = "superintendent"
    CARPENTER = "carpenter"
    LABORER = "laborer"


class LaborItem(Base):
    """Labor line item model"""
    __tablename__ = "labor_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tnm_ticket_id = Column(UUID(as_uuid=True), ForeignKey("tnm_tickets.id", ondelete="CASCADE"), nullable=False, index=True)

    description = Column(Text, nullable=False)
    hours = Column(Numeric(8, 2), nullable=False)
    labor_type = Column(
        SQLEnum(LaborType, name='labor_type', values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    rate_per_hour = Column(Numeric(8, 2), nullable=False)

    # Calculated column
    subtotal = Column(Numeric(12, 2), Computed("hours * rate_per_hour"))

    line_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    tnm_ticket = relationship("TNMTicket", back_populates="labor_items")

    def __repr__(self):
        return f"<LaborItem {self.description}: {self.hours}h @ ${self.rate_per_hour}/h>"
