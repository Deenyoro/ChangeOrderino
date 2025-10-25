"""Asset model"""
from sqlalchemy import Column, String, Text, BigInteger, DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class Asset(Base):
    """Asset/Attachment model (photos, signatures, documents)"""
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tnm_ticket_id = Column(UUID(as_uuid=True), ForeignKey("tnm_tickets.id", ondelete="CASCADE"), index=True)

    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100))
    file_size = Column(BigInteger)
    storage_key = Column(Text, nullable=False)  # MinIO object path
    presigned_url = Column(Text)

    asset_type = Column(String(50))  # 'signature', 'photo', 'document'

    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    tnm_ticket = relationship("TNMTicket", back_populates="assets")

    def __repr__(self):
        return f"<Asset {self.filename} ({self.asset_type})>"
