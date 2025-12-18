from datetime import datetime
from typing import List
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(63), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sql_table_name: Mapped[str] = mapped_column(String(63), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship("Project", back_populates="collections")
    fields: Mapped[List["Field"]] = relationship(
        "Field", back_populates="collection", cascade="all, delete-orphan",
        foreign_keys="[Field.collection_id]"
    )
    policies: Mapped[List["Policy"]] = relationship(
        "Policy", back_populates="collection", cascade="all, delete-orphan"
    )

    __table_args__ = (
        {"schema": None},
    )
