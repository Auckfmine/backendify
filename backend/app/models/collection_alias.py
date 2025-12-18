from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CollectionAlias(Base):
    """Alias mapping for renamed collections - allows old API names to work during grace period."""
    __tablename__ = "collection_aliases"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    collection_id: Mapped[str] = mapped_column(String, ForeignKey("collections.id"), nullable=False, index=True)
    old_name: Mapped[str] = mapped_column(String(63), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False, index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    collection: Mapped["Collection"] = relationship("Collection")


class FieldAlias(Base):
    """Alias mapping for renamed fields - allows old API field names to work during grace period."""
    __tablename__ = "field_aliases"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    field_id: Mapped[str] = mapped_column(String, ForeignKey("fields.id"), nullable=False, index=True)
    collection_id: Mapped[str] = mapped_column(String, ForeignKey("collections.id"), nullable=False, index=True)
    old_name: Mapped[str] = mapped_column(String(63), nullable=False, index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    field: Mapped["Field"] = relationship("Field")
    collection: Mapped["Collection"] = relationship("Collection")
