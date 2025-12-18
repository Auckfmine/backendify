from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class View(Base):
    """Saved query definition - generates read-only API endpoints."""
    __tablename__ = "views"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(63), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    base_collection_id: Mapped[str] = mapped_column(String, ForeignKey("collections.id"), nullable=False)
    
    projection_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    filters_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    sorts_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    joins_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    params_schema_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    default_limit: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    max_limit: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)
    
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship("Project")
    base_collection: Mapped["Collection"] = relationship("Collection")


class ViewVersion(Base):
    """Historical versions of view definitions."""
    __tablename__ = "view_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    view_id: Mapped[str] = mapped_column(String, ForeignKey("views.id"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    
    projection_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    filters_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    sorts_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    joins_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    params_schema_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)

    view: Mapped["View"] = relationship("View")
