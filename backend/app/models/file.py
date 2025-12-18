from datetime import datetime
from uuid import uuid4

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class StoredFile(Base):
    """File metadata stored in the database."""
    __tablename__ = "stored_files"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False, index=True)
    
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(127), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_backend: Mapped[str] = mapped_column(String(32), default="local", nullable=False)
    
    bucket: Mapped[str | None] = mapped_column(String(63), nullable=True)
    collection_id: Mapped[str | None] = mapped_column(String, ForeignKey("collections.id"), nullable=True)
    record_id: Mapped[str | None] = mapped_column(String, nullable=True)
    field_name: Mapped[str | None] = mapped_column(String(63), nullable=True)
    
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    uploaded_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship("Project")
