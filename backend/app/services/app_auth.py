"""
App User Authentication Service

Handles authentication for end-users of customer apps (separate from admin auth).
Uses the _users collection for user storage instead of a separate AppUser model.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    generate_refresh_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.models.app_user import AppRefreshToken, ProjectAuthSettings, AppEmailToken, AppOtpCode, AppIdentity
from app.models.project import Project
from app.services.app_user_service import (
    AppUserRecord,
    get_app_user_by_id,
    get_app_user_by_email,
    create_app_user,
    update_app_user,
)
from app.services.audit_service import (
    log_auth_event,
    AUTH_ACTION_REGISTER,
    AUTH_ACTION_LOGIN,
    AUTH_ACTION_LOGOUT,
    AUTH_ACTION_REFRESH,
    AUTH_ACTION_PASSWORD_CHANGE,
    AUTH_ACTION_PASSWORD_RESET,
    AUTH_ACTION_EMAIL_VERIFY,
)


# JWT claim to distinguish app user tokens from admin tokens
APP_USER_TOKEN_TYPE = "app_user"


def _get_auth_settings(db: Session, project_id: str) -> ProjectAuthSettings:
    """Get or create auth settings for a project."""
    settings_obj = db.query(ProjectAuthSettings).filter(
        ProjectAuthSettings.project_id == project_id
    ).first()
    
    if not settings_obj:
        # Create default settings
        settings_obj = ProjectAuthSettings(project_id=project_id)
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
    
    return settings_obj


def _get_refresh_expiry(auth_settings: ProjectAuthSettings) -> datetime:
    """Get refresh token expiry based on project settings."""
    return datetime.now(tz=timezone.utc) + timedelta(days=auth_settings.refresh_ttl_days)


def _create_app_user_access_token(
    app_user_id: str,
    project_id: str,
    access_ttl_minutes: int
) -> str:
    """Create a JWT access token for an app user."""
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=access_ttl_minutes)
    payload = {
        "sub": app_user_id,
        "project_id": project_id,
        "type": APP_USER_TOKEN_TYPE,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def issue_app_user_tokens(
    db: Session,
    app_user: AppUserRecord,
    auth_settings: ProjectAuthSettings,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> tuple[str, str, int]:
    """
    Issue access and refresh tokens for an app user.
    Returns (access_token, refresh_token, expires_in_seconds).
    """
    access_token = _create_app_user_access_token(
        app_user.id,
        app_user.project_id,
        auth_settings.access_ttl_minutes
    )
    refresh_token = generate_refresh_token()
    token_hash = hash_token(refresh_token)
    
    db_token = AppRefreshToken(
        project_id=app_user.project_id,
        app_user_id=app_user.id,
        token_hash=token_hash,
        revoked=False,
        expires_at=_get_refresh_expiry(auth_settings),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(db_token)
    db.commit()
    
    expires_in = auth_settings.access_ttl_minutes * 60
    return access_token, refresh_token, expires_in


def register_app_user(
    db: Session,
    project: Project,
    email: str,
    password: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> tuple[AppUserRecord, str, str, int]:
    """
    Register a new app user for a project.
    Returns (app_user, access_token, refresh_token, expires_in).
    """
    auth_settings = _get_auth_settings(db, project.id)
    
    # Check if email/password auth is enabled
    if not auth_settings.enable_email_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email/password authentication is not enabled for this project"
        )
    
    # Check if public signup is allowed
    if not auth_settings.allow_public_signup:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public signup is not allowed for this project"
        )
    
    # Check if user already exists
    existing = get_app_user_by_email(db, project.id, email)
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists"
        )
    
    # Create the user in _users collection
    app_user = create_app_user(
        db,
        project.id,
        email=email.lower(),
        password_hash=get_password_hash(password),
        is_email_verified=False,
        is_disabled=False,
    )
    
    # Issue tokens
    access_token, refresh_token, expires_in = issue_app_user_tokens(
        db, app_user, auth_settings, ip_address, user_agent
    )
    
    # Log audit event
    log_auth_event(
        db, project.id, AUTH_ACTION_REGISTER,
        app_user_id=app_user.id, email=email.lower(),
        ip_address=ip_address, user_agent=user_agent
    )
    db.commit()
    
    return app_user, access_token, refresh_token, expires_in


def login_app_user(
    db: Session,
    project: Project,
    email: str,
    password: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> tuple[AppUserRecord, str, str, int]:
    """
    Login an app user.
    Returns (app_user, access_token, refresh_token, expires_in).
    """
    auth_settings = _get_auth_settings(db, project.id)
    
    # Check if email/password auth is enabled
    if not auth_settings.enable_email_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email/password authentication is not enabled for this project"
        )
    
    # Find the user
    app_user = get_app_user_by_email(db, project.id, email)
    
    if not app_user or not app_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not verify_password(password, app_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if app_user.is_disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    
    # Check email verification requirement
    if auth_settings.require_email_verification and not app_user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required"
        )
    
    # Issue tokens
    access_token, refresh_token, expires_in = issue_app_user_tokens(
        db, app_user, auth_settings, ip_address, user_agent
    )
    
    # Log audit event
    log_auth_event(
        db, project.id, AUTH_ACTION_LOGIN,
        app_user_id=app_user.id, email=app_user.email,
        ip_address=ip_address, user_agent=user_agent
    )
    db.commit()
    
    return app_user, access_token, refresh_token, expires_in


def refresh_app_user_tokens(
    db: Session,
    project: Project,
    refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> tuple[AppUserRecord, str, str, int]:
    """
    Refresh tokens for an app user (with rotation).
    Returns (app_user, new_access_token, new_refresh_token, expires_in).
    """
    auth_settings = _get_auth_settings(db, project.id)
    token_hash = hash_token(refresh_token)
    
    # Find the refresh token
    db_token = db.query(AppRefreshToken).filter(
        AppRefreshToken.project_id == project.id,
        AppRefreshToken.token_hash == token_hash,
        AppRefreshToken.revoked.is_(False)
    ).first()
    
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Check expiry
    now = datetime.now(tz=timezone.utc)
    expires_at = db_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired"
        )
    
    # Revoke the old token (rotation)
    db_token.revoked = True
    db_token.last_used_at = now
    db.commit()
    
    # Get the user from _users collection
    app_user = get_app_user_by_id(db, project.id, db_token.app_user_id)
    if not app_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    if app_user.is_disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    
    # Issue new tokens
    access_token, new_refresh_token, expires_in = issue_app_user_tokens(
        db, app_user, auth_settings, ip_address, user_agent
    )
    
    # Log audit event
    log_auth_event(
        db, project.id, AUTH_ACTION_REFRESH,
        app_user_id=app_user.id, email=app_user.email,
        ip_address=ip_address, user_agent=user_agent
    )
    db.commit()
    
    return app_user, access_token, new_refresh_token, expires_in


def logout_app_user(
    db: Session,
    project: Project,
    refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Revoke a refresh token (logout)."""
    token_hash = hash_token(refresh_token)
    
    db_token = db.query(AppRefreshToken).filter(
        AppRefreshToken.project_id == project.id,
        AppRefreshToken.token_hash == token_hash
    ).first()
    
    if db_token:
        db_token.revoked = True
        # Log audit event
        log_auth_event(
            db, project.id, AUTH_ACTION_LOGOUT,
            app_user_id=db_token.app_user_id,
            ip_address=ip_address, user_agent=user_agent
        )
        db.commit()


def logout_all_app_user_sessions(
    db: Session,
    project_id: str,
    app_user_id: str,
    email: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> int:
    """Revoke all refresh tokens for an app user. Returns count of revoked tokens."""
    result = db.query(AppRefreshToken).filter(
        AppRefreshToken.app_user_id == app_user_id,
        AppRefreshToken.revoked.is_(False)
    ).update({"revoked": True})
    
    # Log audit event
    log_auth_event(
        db, project_id, AUTH_ACTION_LOGOUT,
        app_user_id=app_user_id, email=email,
        ip_address=ip_address, user_agent=user_agent,
        details={"all_sessions": True, "revoked_count": result}
    )
    db.commit()
    return result


def decode_app_user_access_token(token: str, project_id: str) -> str:
    """
    Decode and validate an app user access token.
    Returns the app_user_id if valid.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        
        # Verify it's an app user token
        token_type = payload.get("type")
        if token_type != APP_USER_TOKEN_TYPE:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        # Verify project matches
        token_project_id = payload.get("project_id")
        if token_project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token not valid for this project"
            )
        
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        return sub
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


def get_auth_providers(db: Session, project_id: str) -> dict:
    """Get enabled auth providers for a project."""
    auth_settings = _get_auth_settings(db, project_id)
    
    return {
        "email_password": auth_settings.enable_email_password,
        "magic_link": auth_settings.enable_magic_link,
        "otp": auth_settings.enable_otp,
        "oauth_google": auth_settings.enable_oauth_google,
        "oauth_github": auth_settings.enable_oauth_github,
        "session_mode": auth_settings.session_mode,
        "allow_public_signup": auth_settings.allow_public_signup,
    }


def update_auth_settings(
    db: Session,
    project_id: str,
    updates: dict
) -> ProjectAuthSettings:
    """Update auth settings for a project."""
    auth_settings = _get_auth_settings(db, project_id)
    
    for key, value in updates.items():
        if value is not None and hasattr(auth_settings, key):
            setattr(auth_settings, key, value)
    
    db.commit()
    db.refresh(auth_settings)
    return auth_settings


def change_app_user_password(
    db: Session,
    project_id: str,
    app_user_id: str,
    current_password: str,
    new_password: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Change an app user's password."""
    app_user = get_app_user_by_id(db, project_id, app_user_id)
    if not app_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not app_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a password set"
        )
    
    if not verify_password(current_password, app_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    update_app_user(db, project_id, app_user_id, password_hash=get_password_hash(new_password))
    
    # Log audit event
    log_auth_event(
        db, project_id, AUTH_ACTION_PASSWORD_CHANGE,
        app_user_id=app_user.id, email=app_user.email,
        ip_address=ip_address, user_agent=user_agent
    )
    db.commit()


# ============================================================================
# Email Verification
# ============================================================================

EMAIL_TOKEN_EXPIRY_HOURS = 24


def create_email_verification_token(
    db: Session,
    project_id: str,
    app_user_id: str,
) -> str:
    """Create an email verification token for an app user."""
    # Invalidate any existing tokens
    db.query(AppEmailToken).filter(
        AppEmailToken.app_user_id == app_user_id,
        AppEmailToken.purpose == "verify_email",
        AppEmailToken.used_at.is_(None)
    ).delete()
    
    # Create new token
    token = generate_refresh_token()  # Reuse secure token generation
    token_hash = hash_token(token)
    
    email_token = AppEmailToken(
        project_id=project_id,
        app_user_id=app_user_id,
        token_hash=token_hash,
        purpose="verify_email",
        expires_at=datetime.now(tz=timezone.utc) + timedelta(hours=EMAIL_TOKEN_EXPIRY_HOURS),
    )
    db.add(email_token)
    db.commit()
    
    return token


def verify_email_token(
    db: Session,
    project_id: str,
    token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AppUserRecord:
    """Verify an email verification token and mark user's email as verified."""
    token_hash = hash_token(token)
    
    email_token = db.query(AppEmailToken).filter(
        AppEmailToken.project_id == project_id,
        AppEmailToken.token_hash == token_hash,
        AppEmailToken.purpose == "verify_email",
        AppEmailToken.used_at.is_(None)
    ).first()
    
    if not email_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    # Check expiry
    now = datetime.now(tz=timezone.utc)
    expires_at = email_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired"
        )
    
    # Mark token as used
    email_token.used_at = now
    
    # Get and update user
    app_user = get_app_user_by_id(db, project_id, email_token.app_user_id)
    if not app_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    update_app_user(db, project_id, app_user.id, is_email_verified=True)
    
    # Log audit event
    log_auth_event(
        db, project_id, AUTH_ACTION_EMAIL_VERIFY,
        app_user_id=app_user.id, email=app_user.email,
        ip_address=ip_address, user_agent=user_agent
    )
    db.commit()
    
    # Return updated user
    return get_app_user_by_id(db, project_id, app_user.id)


# ============================================================================
# Password Reset
# ============================================================================

PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1


def create_password_reset_token(
    db: Session,
    project: Project,
    email: str,
) -> Optional[str]:
    """
    Create a password reset token for an app user.
    Returns None if user doesn't exist (to prevent email enumeration).
    """
    app_user = get_app_user_by_email(db, project.id, email)
    
    if not app_user:
        # Return None but don't raise error (prevent email enumeration)
        return None
    
    # Invalidate any existing tokens
    db.query(AppEmailToken).filter(
        AppEmailToken.app_user_id == app_user.id,
        AppEmailToken.purpose == "reset_password",
        AppEmailToken.used_at.is_(None)
    ).delete()
    
    # Create new token
    token = generate_refresh_token()
    token_hash = hash_token(token)
    
    email_token = AppEmailToken(
        project_id=project.id,
        app_user_id=app_user.id,
        token_hash=token_hash,
        purpose="reset_password",
        expires_at=datetime.now(tz=timezone.utc) + timedelta(hours=PASSWORD_RESET_TOKEN_EXPIRY_HOURS),
    )
    db.add(email_token)
    db.commit()
    
    return token


def reset_password_with_token(
    db: Session,
    project_id: str,
    token: str,
    new_password: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AppUserRecord:
    """Reset password using a password reset token."""
    token_hash = hash_token(token)
    
    email_token = db.query(AppEmailToken).filter(
        AppEmailToken.project_id == project_id,
        AppEmailToken.token_hash == token_hash,
        AppEmailToken.purpose == "reset_password",
        AppEmailToken.used_at.is_(None)
    ).first()
    
    if not email_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Check expiry
    now = datetime.now(tz=timezone.utc)
    expires_at = email_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )
    
    # Mark token as used
    email_token.used_at = now
    
    # Get and update user
    app_user = get_app_user_by_id(db, project_id, email_token.app_user_id)
    if not app_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    update_app_user(db, project_id, app_user.id, password_hash=get_password_hash(new_password))
    
    # Log audit event
    log_auth_event(
        db, project_id, AUTH_ACTION_PASSWORD_RESET,
        app_user_id=app_user.id, email=app_user.email,
        ip_address=ip_address, user_agent=user_agent
    )
    db.commit()
    
    return get_app_user_by_id(db, project_id, app_user.id)


# ============================================================================
# OTP / Magic Link Login
# ============================================================================

import secrets

OTP_CODE_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


def generate_otp_code() -> str:
    """Generate a 6-digit OTP code."""
    return "".join([str(secrets.randbelow(10)) for _ in range(OTP_CODE_LENGTH)])


def send_otp_code(
    db: Session,
    project: Project,
    email: str,
    purpose: str = "login",
) -> Optional[str]:
    """
    Create and send an OTP code for login or verification.
    Returns the code (for testing) or None if OTP is not enabled.
    """
    auth_settings = _get_auth_settings(db, project.id)
    
    # Check if OTP/magic link is enabled
    if not auth_settings.enable_otp and not auth_settings.enable_magic_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP/Magic link authentication is not enabled for this project"
        )
    
    # For login purpose, check if user exists (create if not for magic link)
    if purpose == "login":
        app_user = get_app_user_by_email(db, project.id, email)
        
        # For magic link, auto-create user if doesn't exist
        if not app_user and auth_settings.enable_magic_link and auth_settings.allow_public_signup:
            app_user = create_app_user(
                db,
                project.id,
                email=email.lower(),
                password_hash=None,  # No password for magic link users
                is_email_verified=False,
                is_disabled=False,
            )
        elif not app_user:
            # Return success but don't create code (prevent email enumeration)
            return None
    
    # Invalidate any existing OTP codes for this email/purpose
    db.query(AppOtpCode).filter(
        AppOtpCode.project_id == project.id,
        AppOtpCode.email == email.lower(),
        AppOtpCode.purpose == purpose
    ).delete()
    
    # Generate new OTP code
    code = generate_otp_code()
    code_hash = hash_token(code)
    
    otp = AppOtpCode(
        project_id=project.id,
        email=email.lower(),
        code_hash=code_hash,
        purpose=purpose,
        expires_at=datetime.now(tz=timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES),
        attempts=0,
    )
    db.add(otp)
    db.commit()
    
    # In production: send email/SMS with code
    # For now, return code directly for testing
    return code


def verify_otp_code(
    db: Session,
    project: Project,
    email: str,
    code: str,
    purpose: str = "login",
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> tuple[AppUserRecord, str, str, int]:
    """
    Verify an OTP code and return tokens if valid.
    Returns (app_user, access_token, refresh_token, expires_in).
    """
    auth_settings = _get_auth_settings(db, project.id)
    
    # Find the OTP code
    otp = db.query(AppOtpCode).filter(
        AppOtpCode.project_id == project.id,
        AppOtpCode.email == email.lower(),
        AppOtpCode.purpose == purpose
    ).first()
    
    if not otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code"
        )
    
    # Check attempts
    if otp.attempts >= OTP_MAX_ATTEMPTS:
        db.delete(otp)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many attempts. Please request a new code."
        )
    
    # Check expiry
    now = datetime.now(tz=timezone.utc)
    expires_at = otp.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < now:
        db.delete(otp)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired"
        )
    
    # Verify the code
    if hash_token(code) != otp.code_hash:
        otp.attempts += 1
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code"
        )
    
    # Code is valid - delete it
    db.delete(otp)
    
    # Get or create user
    app_user = get_app_user_by_email(db, project.id, email)
    
    if not app_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    if app_user.is_disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    
    # Mark email as verified (OTP login proves email ownership)
    if not app_user.is_email_verified:
        update_app_user(db, project.id, app_user.id, is_email_verified=True)
        app_user = get_app_user_by_id(db, project.id, app_user.id)
    
    # Issue tokens
    access_token, refresh_token, expires_in = issue_app_user_tokens(
        db, app_user, auth_settings, ip_address, user_agent
    )
    
    # Log audit event
    log_auth_event(
        db, project.id, AUTH_ACTION_LOGIN,
        app_user_id=app_user.id, email=app_user.email,
        ip_address=ip_address, user_agent=user_agent,
        details={"method": "otp"}
    )
    db.commit()
    
    return app_user, access_token, refresh_token, expires_in


# ============================================================================
# OAuth Login (Google, GitHub)
# ============================================================================

def oauth_login_or_register(
    db: Session,
    project: Project,
    provider: str,
    provider_user_id: str,
    email: Optional[str],
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> tuple[AppUserRecord, str, str, int]:
    """
    Handle OAuth login/registration.
    - If identity exists, login the linked user
    - If email matches existing user, link identity and login
    - If new user, create user and identity
    
    Returns (app_user, access_token, refresh_token, expires_in).
    """
    auth_settings = _get_auth_settings(db, project.id)
    
    # Check if OAuth provider is enabled
    if provider == "google" and not auth_settings.enable_oauth_google:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google OAuth is not enabled for this project"
        )
    if provider == "github" and not auth_settings.enable_oauth_github:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub OAuth is not enabled for this project"
        )
    
    # Check if identity already exists
    identity = db.query(AppIdentity).filter(
        AppIdentity.project_id == project.id,
        AppIdentity.provider == provider,
        AppIdentity.provider_user_id == provider_user_id
    ).first()
    
    if identity:
        # Identity exists - login the linked user
        app_user = get_app_user_by_id(db, project.id, identity.app_user_id)
        if not app_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Linked user not found"
            )
        
        if app_user.is_disabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled"
            )
    else:
        # Identity doesn't exist - check if email matches existing user
        app_user = None
        if email:
            app_user = get_app_user_by_email(db, project.id, email)
        
        if app_user:
            # Link identity to existing user
            if app_user.is_disabled:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is disabled"
                )
        else:
            # Create new user
            if not auth_settings.allow_public_signup:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Public signup is not allowed for this project"
                )
            
            app_user = create_app_user(
                db,
                project.id,
                email=email.lower() if email else None,
                password_hash=None,  # No password for OAuth users
                is_email_verified=True,  # OAuth email is verified by provider
                is_disabled=False,
            )
            
            # Log registration
            log_auth_event(
                db, project.id, AUTH_ACTION_REGISTER,
                app_user_id=app_user.id, email=app_user.email,
                ip_address=ip_address, user_agent=user_agent,
                details={"method": f"oauth_{provider}"}
            )
        
        # Create identity link
        identity = AppIdentity(
            project_id=project.id,
            app_user_id=app_user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
        )
        db.add(identity)
        db.commit()
    
    # Mark email as verified if not already (OAuth proves email ownership)
    if email and not app_user.is_email_verified:
        update_app_user(db, project.id, app_user.id, is_email_verified=True)
        app_user = get_app_user_by_id(db, project.id, app_user.id)
    
    # Issue tokens
    access_token, refresh_token, expires_in = issue_app_user_tokens(
        db, app_user, auth_settings, ip_address, user_agent
    )
    
    # Log login
    log_auth_event(
        db, project.id, AUTH_ACTION_LOGIN,
        app_user_id=app_user.id, email=app_user.email,
        ip_address=ip_address, user_agent=user_agent,
        details={"method": f"oauth_{provider}"}
    )
    db.commit()
    
    return app_user, access_token, refresh_token, expires_in


def get_oauth_state_token(project_id: str, provider: str, redirect_uri: str) -> str:
    """Generate a signed state token for OAuth flow."""
    payload = {
        "project_id": project_id,
        "provider": provider,
        "redirect_uri": redirect_uri,
        "exp": datetime.now(tz=timezone.utc) + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_oauth_state_token(state: str) -> dict:
    """Verify and decode OAuth state token."""
    try:
        payload = jwt.decode(state, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state"
        )
