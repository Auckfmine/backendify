from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False, index=True)
    collection_id: Mapped[str | None] = mapped_column(String, ForeignKey("collections.id"), nullable=True, index=True)
    record_id: Mapped[str | None] = mapped_column(String, nullable=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False)  # Increased for auth actions
    actor_user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    actor_api_key_id: Mapped[str | None] = mapped_column(String, ForeignKey("api_keys.id"), nullable=True)
    # References _users collection record by ID (no FK since it's in project schema)
    actor_app_user_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    old_data_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_data_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
