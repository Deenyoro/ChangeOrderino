"""Email Log model"""
from sqlalchemy import Column, String, Text, DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base


class EmailLog(Base):
    """Email log model (tracking all emails sent)"""
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

    def __repr__(self):
        return f"<EmailLog to={self.to_email} type={self.email_type} status={self.status}>"
