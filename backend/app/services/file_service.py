"""
File Storage Service - Milestone N
Handles file uploads, downloads, and management.
"""
import os
import hashlib
import mimetypes
from datetime import datetime
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.file import StoredFile
from app.models.project import Project

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/backendify_uploads")
MAX_FILE_SIZE = int(os.environ.get("MAX_FILE_SIZE", 10 * 1024 * 1024))
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "pdf", "txt", "csv", "json", "xml", "doc", "docx", "xls", "xlsx"}


def ensure_upload_dir(project_id: str) -> Path:
    """Ensure the upload directory exists for a project."""
    project_dir = Path(UPLOAD_DIR) / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    return project_dir


def get_file_extension(filename: str) -> str:
    """Get the file extension from a filename."""
    if "." in filename:
        return filename.rsplit(".", 1)[1].lower()
    return ""


def is_allowed_extension(filename: str) -> bool:
    """Check if the file extension is allowed."""
    ext = get_file_extension(filename)
    return ext in ALLOWED_EXTENSIONS


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename while preserving the extension."""
    ext = get_file_extension(original_filename)
    unique_id = uuid4().hex[:16]
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    if ext:
        return f"{timestamp}_{unique_id}.{ext}"
    return f"{timestamp}_{unique_id}"


def upload_file(
    db: Session,
    project: Project,
    file_content: bytes,
    original_filename: str,
    content_type: str | None = None,
    bucket: str | None = None,
    collection_id: str | None = None,
    record_id: str | None = None,
    field_name: str | None = None,
    is_public: bool = False,
    uploaded_by_user_id: str | None = None,
) -> StoredFile:
    """Upload a file and store its metadata."""
    if not is_allowed_extension(original_filename):
        ext = get_file_extension(original_filename)
        raise ValueError(f"File extension '{ext}' is not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    
    size_bytes = len(file_content)
    if size_bytes > MAX_FILE_SIZE:
        raise ValueError(f"File size {size_bytes} exceeds maximum allowed size of {MAX_FILE_SIZE} bytes")
    
    if not content_type:
        content_type, _ = mimetypes.guess_type(original_filename)
        content_type = content_type or "application/octet-stream"
    
    project_dir = ensure_upload_dir(project.id)
    unique_filename = generate_unique_filename(original_filename)
    storage_path = project_dir / unique_filename
    
    with open(storage_path, "wb") as f:
        f.write(file_content)
    
    stored_file = StoredFile(
        project_id=project.id,
        filename=unique_filename,
        original_filename=original_filename,
        content_type=content_type,
        size_bytes=size_bytes,
        storage_path=str(storage_path),
        storage_backend="local",
        bucket=bucket,
        collection_id=collection_id,
        record_id=record_id,
        field_name=field_name,
        is_public=is_public,
        uploaded_by_user_id=uploaded_by_user_id,
    )
    db.add(stored_file)
    db.commit()
    db.refresh(stored_file)
    
    return stored_file


def get_file(db: Session, project_id: str, file_id: str) -> StoredFile | None:
    """Get a file by ID."""
    return db.query(StoredFile).filter(
        StoredFile.id == file_id,
        StoredFile.project_id == project_id,
    ).first()


def get_file_content(stored_file: StoredFile) -> bytes:
    """Get the content of a stored file."""
    storage_path = Path(stored_file.storage_path)
    if not storage_path.exists():
        raise FileNotFoundError(f"File not found at {storage_path}")
    
    with open(storage_path, "rb") as f:
        return f.read()


def list_files(
    db: Session,
    project_id: str,
    bucket: str | None = None,
    collection_id: str | None = None,
    record_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[StoredFile]:
    """List files for a project with optional filters."""
    query = db.query(StoredFile).filter(StoredFile.project_id == project_id)
    
    if bucket:
        query = query.filter(StoredFile.bucket == bucket)
    if collection_id:
        query = query.filter(StoredFile.collection_id == collection_id)
    if record_id:
        query = query.filter(StoredFile.record_id == record_id)
    
    return query.order_by(StoredFile.created_at.desc()).offset(offset).limit(limit).all()


def delete_file(db: Session, stored_file: StoredFile) -> None:
    """Delete a file and its metadata."""
    storage_path = Path(stored_file.storage_path)
    if storage_path.exists():
        storage_path.unlink()
    
    db.delete(stored_file)
    db.commit()


def get_file_url(stored_file: StoredFile, base_url: str = "") -> str:
    """Generate a URL for accessing a file."""
    return f"{base_url}/api/projects/{stored_file.project_id}/files/{stored_file.id}/download"


def get_storage_stats(db: Session, project_id: str) -> dict:
    """Get storage statistics for a project."""
    from sqlalchemy import func
    
    result = db.query(
        func.count(StoredFile.id).label("file_count"),
        func.sum(StoredFile.size_bytes).label("total_bytes"),
    ).filter(StoredFile.project_id == project_id).first()
    
    return {
        "file_count": result.file_count or 0,
        "total_bytes": result.total_bytes or 0,
        "total_mb": round((result.total_bytes or 0) / (1024 * 1024), 2),
    }
