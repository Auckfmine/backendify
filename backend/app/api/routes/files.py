"""
Files API Routes - Milestone N
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.services import file_service

router = APIRouter()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    bucket: str | None = Form(None),
    is_public: bool = Form(False),
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Upload a file."""
    try:
        content = await file.read()
        stored_file = file_service.upload_file(
            db=db,
            project=project,
            file_content=content,
            original_filename=file.filename or "unnamed",
            content_type=file.content_type,
            bucket=bucket,
            is_public=is_public,
            uploaded_by_user_id=current_user.id,
        )
        return {
            "id": stored_file.id,
            "filename": stored_file.filename,
            "original_filename": stored_file.original_filename,
            "content_type": stored_file.content_type,
            "size_bytes": stored_file.size_bytes,
            "bucket": stored_file.bucket,
            "is_public": stored_file.is_public,
            "download_url": file_service.get_file_url(stored_file),
            "created_at": stored_file.created_at.isoformat(),
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("")
def list_files(
    bucket: str | None = Query(None),
    collection_id: str | None = Query(None),
    record_id: str | None = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """List files for a project."""
    files = file_service.list_files(
        db=db,
        project_id=project.id,
        bucket=bucket,
        collection_id=collection_id,
        record_id=record_id,
        limit=limit,
        offset=offset,
    )
    return [
        {
            "id": f.id,
            "filename": f.filename,
            "original_filename": f.original_filename,
            "content_type": f.content_type,
            "size_bytes": f.size_bytes,
            "bucket": f.bucket,
            "collection_id": f.collection_id,
            "record_id": f.record_id,
            "field_name": f.field_name,
            "is_public": f.is_public,
            "uploaded_by_user_id": f.uploaded_by_user_id,
            "created_at": f.created_at.isoformat(),
            "updated_at": f.updated_at.isoformat(),
        }
        for f in files
    ]


@router.get("/stats")
def get_storage_stats(
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Get storage statistics for a project."""
    return file_service.get_storage_stats(db, project.id)


@router.get("/{file_id}")
def get_file_metadata(
    file_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Get file metadata."""
    stored_file = file_service.get_file(db, project.id, file_id)
    if not stored_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    return {
        "id": stored_file.id,
        "filename": stored_file.filename,
        "original_filename": stored_file.original_filename,
        "content_type": stored_file.content_type,
        "size_bytes": stored_file.size_bytes,
        "bucket": stored_file.bucket,
        "collection_id": stored_file.collection_id,
        "record_id": stored_file.record_id,
        "field_name": stored_file.field_name,
        "is_public": stored_file.is_public,
        "uploaded_by_user_id": stored_file.uploaded_by_user_id,
        "download_url": file_service.get_file_url(stored_file),
        "created_at": stored_file.created_at.isoformat(),
        "updated_at": stored_file.updated_at.isoformat(),
    }


@router.get("/{file_id}/download")
def download_file(
    file_id: str,
    project_id: str,
    db: Session = Depends(deps.get_db),
):
    """Download a file. Public files can be downloaded without auth."""
    stored_file = file_service.get_file(db, project_id, file_id)
    if not stored_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    if not stored_file.is_public:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    try:
        content = file_service.get_file_content(stored_file)
        return Response(
            content=content,
            media_type=stored_file.content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{stored_file.original_filename}"',
            },
        )
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File content not found")


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Delete a file."""
    stored_file = file_service.get_file(db, project.id, file_id)
    if not stored_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    file_service.delete_file(db, stored_file)
