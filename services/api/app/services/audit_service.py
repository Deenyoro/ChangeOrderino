"""Audit service for logging all changes"""
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal

from app.models.audit_log import AuditLog


class AuditService:
    """Service for logging all changes"""

    @staticmethod
    def _serialize_for_json(value: Any) -> Any:
        """
        Convert Python types to JSON-serializable types

        Handles: Decimal, UUID, datetime, date, and nested dicts/lists
        """
        if value is None:
            return None
        elif isinstance(value, (str, int, float, bool)):
            return value
        elif isinstance(value, Decimal):
            return str(value)
        elif isinstance(value, UUID):
            return str(value)
        elif isinstance(value, (datetime, date)):
            return value.isoformat()
        elif isinstance(value, dict):
            return {k: AuditService._serialize_for_json(v) for k, v in value.items()}
        elif isinstance(value, (list, tuple)):
            return [AuditService._serialize_for_json(item) for item in value]
        else:
            return str(value)

    @staticmethod
    async def log(
        db: AsyncSession,
        entity_type: str,
        entity_id: UUID,
        action: str,
        user_id: Optional[UUID] = None,
        changes: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """
        Log an audit event

        Args:
            db: Database session
            entity_type: Type of entity ('tnm_ticket', 'project', etc.)
            entity_id: ID of entity
            action: Action performed ('create', 'update', 'delete', etc.)
            user_id: User who performed action (optional for GC approvals)
            changes: Dict of field changes {field: {old: val, new: val}}
            ip_address: Request IP
            user_agent: Request user agent
        """
        # Ensure changes are JSON-serializable
        serialized_changes = AuditService._serialize_for_json(changes or {})

        log_entry = AuditLog(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            changes=serialized_changes,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        db.add(log_entry)
        # Don't commit here - let endpoint commit transaction

    @staticmethod
    def compute_changes(old_obj: Any, new_data: dict) -> dict:
        """
        Compute what changed between old object and new data

        Returns:
            {
                "field_name": {
                    "old": old_value,
                    "new": new_value
                }
            }
        """
        changes = {}

        for field, new_value in new_data.items():
            old_value = getattr(old_obj, field, None)

            # Convert to comparable types
            old_str = str(old_value) if old_value is not None else None
            new_str = str(new_value) if new_value is not None else None

            if old_str != new_str:
                changes[field] = {
                    "old": old_str,
                    "new": new_str,
                }

        return changes


# Singleton instance
audit_service = AuditService()
