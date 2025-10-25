from minio import Minio
from minio.error import S3Error
from typing import Optional, BinaryIO
from datetime import timedelta
from uuid import uuid4
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class StorageService:
    """MinIO storage client for asset management"""

    def __init__(self):
        # Parse MinIO URL
        server_url = settings.MINIO_SERVER_URL.replace('http://', '').replace('https://', '')

        self.client = Minio(
            server_url,
            access_key=settings.MINIO_ROOT_USER,
            secret_key=settings.MINIO_ROOT_PASSWORD,
            secure=settings.MINIO_SECURE,
        )

        self.bucket_name = settings.MINIO_BUCKET_NAME

        # Ensure bucket exists
        self._ensure_bucket()

    def _ensure_bucket(self):
        """Create bucket if it doesn't exist"""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                logger.info("minio_bucket_created", bucket=self.bucket_name)
        except S3Error as e:
            logger.error("minio_bucket_error", error=str(e))

    def upload_file(
        self,
        file_data: BinaryIO,
        filename: str,
        content_type: str = 'application/octet-stream',
        folder: str = 'uploads',
    ) -> tuple[str, int]:
        """
        Upload file to MinIO

        Args:
            file_data: File bytes
            filename: Original filename
            content_type: MIME type
            folder: Subfolder in bucket

        Returns:
            (storage_key, file_size)
        """
        # Generate unique storage key
        file_ext = filename.split('.')[-1] if '.' in filename else ''
        storage_key = f"{folder}/{uuid4()}.{file_ext}" if file_ext else f"{folder}/{uuid4()}"

        # Get file size
        file_data.seek(0, 2)  # Seek to end
        file_size = file_data.tell()
        file_data.seek(0)  # Reset to beginning

        # Upload to MinIO
        self.client.put_object(
            bucket_name=self.bucket_name,
            object_name=storage_key,
            data=file_data,
            length=file_size,
            content_type=content_type,
        )

        logger.info(
            "file_uploaded",
            storage_key=storage_key,
            size=file_size,
            content_type=content_type
        )

        return storage_key, file_size

    def get_presigned_url(
        self,
        storage_key: str,
        expires: timedelta = timedelta(hours=1),
    ) -> str:
        """
        Generate presigned URL for temporary access

        Args:
            storage_key: Object key in bucket
            expires: Expiration time (default 1 hour)

        Returns:
            Presigned URL
        """
        url = self.client.presigned_get_object(
            bucket_name=self.bucket_name,
            object_name=storage_key,
            expires=expires,
        )

        return url

    def delete_file(self, storage_key: str):
        """Delete file from MinIO"""
        try:
            self.client.remove_object(
                bucket_name=self.bucket_name,
                object_name=storage_key,
            )
            logger.info("file_deleted", storage_key=storage_key)
        except S3Error as e:
            logger.error("file_delete_error", storage_key=storage_key, error=str(e))

    def get_file(self, storage_key: str) -> bytes:
        """Get file contents"""
        response = self.client.get_object(
            bucket_name=self.bucket_name,
            object_name=storage_key,
        )

        return response.read()

    def list_files(self, prefix: str = '') -> list:
        """List files with optional prefix"""
        objects = self.client.list_objects(
            bucket_name=self.bucket_name,
            prefix=prefix,
        )

        return [
            {
                'storage_key': obj.object_name,
                'size': obj.size,
                'last_modified': obj.last_modified,
            }
            for obj in objects
        ]


# Singleton instance
storage_service = StorageService()
