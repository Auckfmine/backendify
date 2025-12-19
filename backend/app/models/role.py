from datetime import datetime
from typing import List, TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import Project


class Role(Base):
    """
    Roles define access levels that can be assigned to app users.
    Each project can have multiple roles (e.g., admin, editor, viewer).
    Roles are used in policies via allowed_roles to control data access.
    """
    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_roles_project_name"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(63), nullable=False)
    display_name: Mapped[str] = mapped_column(String(127), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # System roles cannot be deleted or renamed
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Default role is assigned to new users automatically
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="roles")
    user_roles: Mapped[List["AppUserRole"]] = relationship(
        "AppUserRole", back_populates="role", cascade="all, delete-orphan"
    )


class AppUserRole(Base):
    """
    Assigns roles to app users stored in the _users collection.
    An app user can have multiple roles.
    References app users by ID (no FK since users are in project schema).
    """
    __tablename__ = "app_user_roles"
    __table_args__ = (
        UniqueConstraint("app_user_id", "role_id", name="uq_app_user_roles"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    # References _users collection record by ID (no FK since it's in project schema)
    app_user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    role_id: Mapped[str] = mapped_column(
        String, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # Who assigned this role
    assigned_by: Mapped[str | None] = mapped_column(String, nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    role: Mapped["Role"] = relationship("Role", back_populates="user_roles")
