from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.app_user import AppUser, ProjectAuthSettings


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memberships: Mapped[List["Membership"]] = relationship(
        "Membership", back_populates="project", cascade="all, delete-orphan"
    )
    api_keys: Mapped[List["ApiKey"]] = relationship(
        "ApiKey", back_populates="project", cascade="all, delete-orphan"
    )
    collections: Mapped[List["Collection"]] = relationship(
        "Collection", back_populates="project", cascade="all, delete-orphan"
    )
    app_users: Mapped[List["AppUser"]] = relationship(
        "AppUser", back_populates="project", cascade="all, delete-orphan"
    )
    auth_settings: Mapped[Optional["ProjectAuthSettings"]] = relationship(
        "ProjectAuthSettings", back_populates="project", uselist=False, cascade="all, delete-orphan"
    )
