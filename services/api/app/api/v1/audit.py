"""Audit log endpoints"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict
from datetime import datetime

from app.core.database import get_db
from app.core.auth import get_current_user, TokenData
from app.models.audit_log import AuditLog

router = APIRouter()


# ============ SCHEMAS ============

class AuditLogResponse(BaseModel):
    """Audit log response schema"""
    id: str
    user_id: str | None
    entity_type: str
    entity_id: str
    action: str
    changes: dict
    ip_address: str | None
    user_agent: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ ENDPOINTS ============

@router.get("/{entity_type}/{entity_id}", response_model=List[AuditLogResponse])
async def get_audit_logs(
    entity_type: str,
    entity_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Get audit history for an entity

    Args:
        entity_type: Type of entity ('tnm_ticket', 'project', etc.)
        entity_id: ID of the entity

    Returns:
        List of audit log entries ordered by most recent first
    """
    result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id
        )
        .order_by(AuditLog.created_at.desc())
    )
    logs = result.scalars().all()

    return [
        AuditLogResponse(
            id=str(log.id),
            user_id=str(log.user_id) if log.user_id else None,
            entity_type=log.entity_type,
            entity_id=str(log.entity_id),
            action=log.action,
            changes=log.changes or {},
            ip_address=str(log.ip_address) if log.ip_address else None,
            user_agent=log.user_agent,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get("/user/{user_id}", response_model=List[AuditLogResponse])
async def get_user_audit_logs(
    user_id: UUID,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Get audit history for a specific user

    Args:
        user_id: User ID
        limit: Maximum number of entries to return (default 100)

    Returns:
        List of audit log entries for this user ordered by most recent first
    """
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()

    return [
        AuditLogResponse(
            id=str(log.id),
            user_id=str(log.user_id) if log.user_id else None,
            entity_type=log.entity_type,
            entity_id=str(log.entity_id),
            action=log.action,
            changes=log.changes or {},
            ip_address=str(log.ip_address) if log.ip_address else None,
            user_agent=log.user_agent,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get("/", response_model=List[AuditLogResponse])
async def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    entity_type: str | None = None,
    action: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    List all audit logs with optional filters

    Args:
        skip: Number of entries to skip (pagination)
        limit: Maximum number of entries to return
        entity_type: Filter by entity type (optional)
        action: Filter by action (optional)

    Returns:
        List of audit log entries ordered by most recent first
    """
    query = select(AuditLog)

    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)

    if action:
        query = query.where(AuditLog.action == action)

    query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    return [
        AuditLogResponse(
            id=str(log.id),
            user_id=str(log.user_id) if log.user_id else None,
            entity_type=log.entity_type,
            entity_id=str(log.entity_id),
            action=log.action,
            changes=log.changes or {},
            ip_address=str(log.ip_address) if log.ip_address else None,
            user_agent=log.user_agent,
            created_at=log.created_at,
        )
        for log in logs
    ]
