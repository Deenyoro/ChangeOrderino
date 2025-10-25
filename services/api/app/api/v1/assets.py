"""Asset/file upload endpoints"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import timedelta
from io import BytesIO

from app.core.database import get_db
from app.core.auth import get_current_user, TokenData
from app.models.asset import Asset
from app.models.tnm_ticket import TNMTicket
from app.services.storage import storage_service

router = APIRouter()


@router.post("/upload")
async def upload_asset(
    file: UploadFile = File(...),
    tnm_ticket_id: str = Form(...),
    asset_type: str = Form(...),  # 'signature', 'photo', 'document'
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Upload an asset (photo, signature, document)

    Accepts multipart/form-data with:
    - file: The file to upload
    - tnm_ticket_id: UUID of TNM ticket
    - asset_type: 'signature', 'photo', or 'document'
    """
    # Validate ticket exists
    result = await db.execute(
        select(TNMTicket).where(TNMTicket.id == UUID(tnm_ticket_id))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="TNM ticket not found")

    # Validate file type
    allowed_types = {
        'signature': ['image/png', 'image/jpeg'],
        'photo': ['image/png', 'image/jpeg', 'image/jpg'],
        'document': ['application/pdf', 'image/png', 'image/jpeg'],
    }

    if file.content_type not in allowed_types.get(asset_type, []):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type for {asset_type}. Allowed: {allowed_types[asset_type]}"
        )

    # Validate file size (10MB max)
    file_contents = await file.read()
    file_size = len(file_contents)

    if file_size > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Upload to MinIO
    storage_key, _ = storage_service.upload_file(
        file_data=BytesIO(file_contents),
        filename=file.filename,
        content_type=file.content_type,
        folder=f"tnm-tickets/{tnm_ticket_id}/{asset_type}",
    )

    # Create asset record
    asset = Asset(
        tnm_ticket_id=UUID(tnm_ticket_id),
        filename=file.filename,
        mime_type=file.content_type,
        file_size=file_size,
        storage_key=storage_key,
        asset_type=asset_type,
        uploaded_by=UUID(current_user.sub),
    )

    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    # Generate presigned URL (valid 1 hour)
    presigned_url = storage_service.get_presigned_url(
        storage_key,
        expires=timedelta(hours=1)
    )

    return {
        "id": str(asset.id),
        "filename": asset.filename,
        "storage_key": storage_key,
        "presigned_url": presigned_url,
        "asset_type": asset_type,
        "file_size": file_size,
        "uploaded_at": asset.created_at.isoformat(),
    }


@router.get("/{asset_id}")
async def get_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get asset metadata and presigned URL"""
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id)
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Generate fresh presigned URL
    presigned_url = storage_service.get_presigned_url(
        asset.storage_key,
        expires=timedelta(hours=1)
    )

    return {
        "id": str(asset.id),
        "filename": asset.filename,
        "mime_type": asset.mime_type,
        "file_size": asset.file_size,
        "storage_key": asset.storage_key,
        "presigned_url": presigned_url,
        "asset_type": asset.asset_type,
        "tnm_ticket_id": str(asset.tnm_ticket_id),
        "uploaded_at": asset.created_at.isoformat(),
    }


@router.get("/ticket/{ticket_id}")
async def list_ticket_assets(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List all assets for a TNM ticket"""
    result = await db.execute(
        select(Asset)
        .where(Asset.tnm_ticket_id == ticket_id)
        .order_by(Asset.created_at.desc())
    )
    assets = result.scalars().all()

    return [
        {
            "id": str(asset.id),
            "filename": asset.filename,
            "asset_type": asset.asset_type,
            "file_size": asset.file_size,
            "presigned_url": storage_service.get_presigned_url(
                asset.storage_key,
                expires=timedelta(hours=1)
            ),
            "uploaded_at": asset.created_at.isoformat(),
        }
        for asset in assets
    ]


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Delete an asset"""
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id)
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Delete from MinIO
    storage_service.delete_file(asset.storage_key)

    # Delete from database
    await db.delete(asset)
    await db.commit()

    return {"success": True, "asset_id": str(asset_id)}
