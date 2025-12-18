from datetime import datetime
from typing import List, TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, String, func, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import Project


class AppUser(Base):
    """
    App users are end-users of customer apps (not admin/console users).
    They are scoped to a specific project.
    """
    __tablename__ = "app_users"
    __table_args__ = (
        UniqueConstraint("project_id", "email", name="uq_app_users_project_email"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)  # nullable for oauth-only users
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_disabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="app_users")
    refresh_tokens: Mapped[List["AppRefreshToken"]] = relationship(
        "AppRefreshToken", back_populates="app_user", cascade="all, delete-orphan"
    )
    identities: Mapped[List["AppIdentity"]] = relationship(
        "AppIdentity", back_populates="app_user", cascade="all, delete-orphan"
    )


class AppRefreshToken(Base):
    """
    Refresh tokens for app users (separate from admin refresh tokens).
    """
    __tablename__ = "app_refresh_tokens"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    app_user_id: Mapped[str] = mapped_column(String, ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String, nullable=True)

    # Relationships
    app_user: Mapped["AppUser"] = relationship("AppUser", back_populates="refresh_tokens")


class ProjectAuthSettings(Base):
    """
    Auth configuration per project - which methods are enabled, TTLs, etc.
    """
    __tablename__ = "project_auth_settings"

    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    
    # Auth methods
    enable_email_password: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_magic_link: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    enable_otp: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    enable_oauth_google: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    enable_oauth_github: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Token settings
    access_ttl_minutes: Mapped[int] = mapped_column(default=15, nullable=False)
    refresh_ttl_days: Mapped[int] = mapped_column(default=7, nullable=False)
    
    # Session mode: 'header' or 'cookie'
    session_mode: Mapped[str] = mapped_column(String, default="header", nullable=False)
    
    # Public access
    allow_public_signup: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    require_email_verification: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="auth_settings")


class AppOtpCode(Base):
    """
    OTP codes for magic link / passwordless login / email verification / password reset.
    """
    __tablename__ = "app_otp_codes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String, nullable=False)
    purpose: Mapped[str] = mapped_column(String, nullable=False)  # 'login', 'verify_email', 'reset_password'
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AppIdentity(Base):
    """
    OAuth identities linked to app users (Google, GitHub, etc.).
    """
    __tablename__ = "app_identities"
    __table_args__ = (
        UniqueConstraint("project_id", "provider", "provider_user_id", name="uq_app_identities_provider"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    app_user_id: Mapped[str] = mapped_column(String, ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String, nullable=False)  # 'google', 'github'
    provider_user_id: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    app_user: Mapped["AppUser"] = relationship("AppUser", back_populates="identities")


class AppEmailToken(Base):
    """
    Tokens for email verification and password reset (longer-lived than OTP).
    """
    __tablename__ = "app_email_tokens"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    app_user_id: Mapped[str] = mapped_column(String, ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    purpose: Mapped[str] = mapped_column(String, nullable=False)  # 'verify_email', 'reset_password'
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
