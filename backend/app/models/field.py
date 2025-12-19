from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Field(Base):
    __tablename__ = "fields"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    collection_id: Mapped[str] = mapped_column(String, ForeignKey("collections.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(63), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[str] = mapped_column(String(32), nullable=False)
    sql_column_name: Mapped[str] = mapped_column(String(63), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_unique: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_indexed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    default_value: Mapped[str | None] = mapped_column(String, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # System fields cannot be deleted or have their type changed
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Hidden fields are never exposed in API responses (e.g., password_hash)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    relation_target_collection_id: Mapped[str | None] = mapped_column(String, ForeignKey("collections.id"), nullable=True)
    relation_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    relation_on_delete: Mapped[str | None] = mapped_column(String(32), nullable=True, default="RESTRICT")
    relation_display_field: Mapped[str | None] = mapped_column(String(63), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    collection: Mapped["Collection"] = relationship("Collection", back_populates="fields", foreign_keys=[collection_id])
    relation_target_collection: Mapped["Collection"] = relationship("Collection", foreign_keys=[relation_target_collection_id])
