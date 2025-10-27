"""Utility endpoints for file processing"""
import logging
import io
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List
import fitz  # PyMuPDF
from PIL import Image

from app.core.auth import get_current_user, TokenData
from app.services.storage import storage_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/convert-pdf")
async def convert_pdf_to_images(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """
    Convert a PDF file to images (one image per page)

    Args:
        file: PDF file to convert

    Returns:
        dict with image_urls array containing storage URLs for each page
    """
    try:
        # Validate file type
        if not file.content_type or 'pdf' not in file.content_type.lower():
            raise HTTPException(status_code=400, detail="File must be a PDF")

        # Read PDF file
        pdf_bytes = await file.read()

        # Open PDF with PyMuPDF
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")

        image_urls = []

        # Convert each page to image
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]

            # Render page to image at 150 DPI (good quality for viewing and PDFs)
            pix = page.get_pixmap(matrix=fitz.Matrix(150/72, 150/72))

            # Convert to PIL Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

            # Convert to JPEG in memory
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='JPEG', quality=85, optimize=True)
            img_buffer.seek(0)

            # Generate unique filename
            image_filename = f"pdf-page-{page_num + 1}-{uuid.uuid4().hex[:8]}.jpg"

            # Upload to storage
            storage_url = await storage_service.upload_file(
                file_data=img_buffer.getvalue(),
                filename=image_filename,
                content_type="image/jpeg",
                folder="temp/pdf-conversions"
            )

            image_urls.append(storage_url)
            logger.info(f"Converted PDF page {page_num + 1} to image: {storage_url}")

        pdf_document.close()

        logger.info(f"Successfully converted PDF with {len(image_urls)} pages to images")

        return {
            "success": True,
            "page_count": len(image_urls),
            "image_urls": image_urls
        }

    except fitz.FileDataError:
        raise HTTPException(status_code=400, detail="Invalid or corrupted PDF file")
    except Exception as e:
        logger.error(f"Error converting PDF to images: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to convert PDF: {str(e)}")
