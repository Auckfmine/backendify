from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    collection_id: Mapped[str] = mapped_column(String, ForeignKey("collections.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(63), nullable=False)
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    effect: Mapped[str] = mapped_column(String(8), nullable=False, default="allow")
    condition_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    priority: Mapped[int] = mapped_column(default=0, nullable=False)
    # Allowed principals: comma-separated list of "admin_user", "app_user", "api_key", "anonymous"
    # If NULL or empty, defaults to ["admin_user", "api_key"] for backward compatibility
    allowed_principals: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Require email verification for app_user principal
    require_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    collection: Mapped["Collection"] = relationship("Collection", back_populates="policies")
