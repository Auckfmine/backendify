from pydantic import BaseModel, Field
from typing import Any


class FileUploadResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    content_type: str
    size_bytes: int
    bucket: str | None
    is_public: bool
    download_url: str
    created_at: str


class FileOut(BaseModel):
    id: str
    filename: str
    original_filename: str
    content_type: str
    size_bytes: int
    bucket: str | None
    collection_id: str | None
    record_id: str | None
    field_name: str | None
    is_public: bool
    uploaded_by_user_id: str | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class StorageStatsResponse(BaseModel):
    file_count: int
    total_bytes: int
    total_mb: float
