"""
Auth Settings Routes (Admin)

Endpoints for project admins to configure app user authentication settings.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.project import Project
from app.models.app_user import ProjectAuthSettings
from app.core.security import get_password_hash
from app.schemas.app_auth import (
    AuthSettingsOut,
    AuthSettingsUpdate,
    AppUserListOut,
    AppUserCreateIn,
    AppUserUpdateIn,
)
from app.services import app_auth
from app.services import app_user_service

router = APIRouter()


@router.get("", response_model=AuthSettingsOut)
def get_auth_settings(
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Get auth settings for a project (admin only)."""
    settings = db.query(ProjectAuthSettings).filter(
        ProjectAuthSettings.project_id == project.id
    ).first()
    
    if not settings:
        # Create default settings
        settings = ProjectAuthSettings(project_id=project.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return settings


@router.put("", response_model=AuthSettingsOut)
def update_auth_settings(
    payload: AuthSettingsUpdate,
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Update auth settings for a project (admin only)."""
    settings = app_auth.update_auth_settings(
        db, project.id, payload.model_dump(exclude_unset=True)
    )
    return settings


# ============================================================================
# App User Management (Admin)
# ============================================================================

@router.get("/users", response_model=list[AppUserListOut])
def list_app_users(
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    limit: int = 100,
    offset: int = 0,
):
    """List app users for a project (admin only)."""
    users = app_user_service.list_app_users(db, project.id, limit=limit, offset=offset)
    return [_user_record_to_dict(u) for u in users]


@router.post("/users", response_model=AppUserListOut, status_code=status.HTTP_201_CREATED)
def create_app_user(
    payload: AppUserCreateIn,
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Create a new app user (admin only)."""
    # Check if user already exists
    existing = app_user_service.get_app_user_by_email(db, project.id, payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists"
        )
    
    # Hash password if provided
    password_hash = get_password_hash(payload.password) if payload.password else None
    
    user = app_user_service.create_app_user(
        db,
        project.id,
        email=payload.email,
        password_hash=password_hash,
        is_email_verified=payload.is_email_verified,
        is_disabled=payload.is_disabled,
    )
    
    return _user_record_to_dict(user)


@router.get("/users/{app_user_id}", response_model=AppUserListOut)
def get_app_user(
    app_user_id: str,
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Get an app user by ID (admin only)."""
    user = app_user_service.get_app_user_by_id(db, project.id, app_user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="App user not found")
    
    return _user_record_to_dict(user)


@router.patch("/users/{app_user_id}", response_model=AppUserListOut)
def update_app_user(
    app_user_id: str,
    payload: AppUserUpdateIn,
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Update an app user (admin only) - email, password, enable/disable, verify email."""
    user = app_user_service.get_app_user_by_id(db, project.id, app_user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="App user not found")
    
    # Check if email is being changed and if it's already taken
    if payload.email and payload.email.lower() != user.email.lower():
        existing = app_user_service.get_app_user_by_email(db, project.id, payload.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists"
            )
    
    # Hash password if provided
    password_hash = get_password_hash(payload.password) if payload.password else None
    
    updated_user = app_user_service.update_app_user(
        db, project.id, app_user_id,
        email=payload.email,
        password_hash=password_hash,
        is_disabled=payload.is_disabled,
        is_email_verified=payload.is_email_verified,
    )
    
    return _user_record_to_dict(updated_user)


@router.delete("/users/{app_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_app_user(
    app_user_id: str,
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Delete an app user (admin only)."""
    user = app_user_service.get_app_user_by_id(db, project.id, app_user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="App user not found")
    
    app_user_service.delete_app_user(db, project.id, app_user_id)
    return None


@router.post("/users/{app_user_id}/revoke-sessions", status_code=status.HTTP_204_NO_CONTENT)
def revoke_app_user_sessions(
    app_user_id: str,
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Revoke all sessions for an app user (admin only)."""
    user = app_user_service.get_app_user_by_id(db, project.id, app_user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="App user not found")
    
    app_auth.logout_all_app_user_sessions(db, project.id, user.id, email=user.email)
    return None


def _user_record_to_dict(user: app_user_service.AppUserRecord) -> dict:
    """Convert AppUserRecord to dict for Pydantic serialization."""
    return {
        "id": user.id,
        "email": user.email,
        "is_email_verified": user.is_email_verified,
        "is_disabled": user.is_disabled,
        "created_at": user.created_at,
    }
