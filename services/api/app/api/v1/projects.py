"""Project/Job management endpoints"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user, TokenData
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.services.audit_service import audit_service

router = APIRouter()


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List all projects"""
    query = select(Project)

    if active_only:
        query = query.where(Project.is_active == True)

    query = query.offset(skip).limit(limit).order_by(Project.created_at.desc())

    result = await db.execute(query)
    projects = result.scalars().all()

    return projects


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Create a new project"""
    # Create project
    project = Project(**project_data.model_dump())

    db.add(project)
    await db.flush()  # Get project ID

    # Log creation
    await audit_service.log(
        db=db,
        entity_type='project',
        entity_id=project.id,
        action='create',
        user_id=UUID(current_user.sub),
        changes={'all_fields': project_data.model_dump()},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    await db.commit()
    await db.refresh(project)

    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get a single project"""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Update a project"""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    # Compute changes
    update_data = project_data.model_dump(exclude_unset=True)
    changes = audit_service.compute_changes(project, update_data)

    # Update fields
    for field, value in update_data.items():
        setattr(project, field, value)

    # Log update
    await audit_service.log(
        db=db,
        entity_type='project',
        entity_id=project_id,
        action='update',
        user_id=UUID(current_user.sub),
        changes=changes,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    await db.commit()
    await db.refresh(project)

    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Delete a project (soft delete by marking inactive)"""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    # Soft delete
    old_status = project.is_active
    project.is_active = False

    # Log deletion
    await audit_service.log(
        db=db,
        entity_type='project',
        entity_id=project_id,
        action='delete',
        user_id=UUID(current_user.sub),
        changes={'is_active': {'old': str(old_status), 'new': 'False'}},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
    )

    await db.commit()

    return None
