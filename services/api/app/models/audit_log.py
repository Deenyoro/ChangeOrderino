"""Audit Log model"""
from sqlalchemy import Column, String, Text, DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
import uuid

from app.core.database import Base


class AuditLog(Base):
    """Audit log model (track all changes)"""
    __tablename__ = "audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)

    entity_type = Column(String(100), nullable=False, index=True)  # 'tnm_ticket', 'project', 'approval'
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    action = Column(String(50), nullable=False)  # 'create', 'update', 'delete', 'send', 'approve', 'deny'
    changes = Column(JSONB)  # {"field": {"old": "value", "new": "value"}}

    ip_address = Column(INET)
    user_agent = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self):
        return f"<AuditLog {self.action} on {self.entity_type} {self.entity_id}>"
