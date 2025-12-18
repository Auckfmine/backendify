"""
Auth Settings Routes (Admin)

Endpoints for project admins to configure app user authentication settings.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.project import Project
from app.models.user import User
from app.models.app_user import AppUser, ProjectAuthSettings
from app.schemas.app_auth import (
    AuthSettingsOut,
    AuthSettingsUpdate,
    AppUserListOut,
    AppUserUpdateIn,
)
from app.services import app_auth

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
    users = db.query(AppUser).filter(
        AppUser.project_id == project.id
    ).order_by(AppUser.created_at.desc()).offset(offset).limit(limit).all()
    return users


@router.get("/users/{app_user_id}", response_model=AppUserListOut)
def get_app_user(
    app_user_id: str,
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Get an app user by ID (admin only)."""
    from fastapi import HTTPException
    
    user = db.query(AppUser).filter(
        AppUser.project_id == project.id,
        AppUser.id == app_user_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="App user not found")
    
    return user


@router.patch("/users/{app_user_id}", response_model=AppUserListOut)
def update_app_user(
    app_user_id: str,
    payload: AppUserUpdateIn,
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Update an app user (admin only) - enable/disable, verify email."""
    from fastapi import HTTPException
    
    user = db.query(AppUser).filter(
        AppUser.project_id == project.id,
        AppUser.id == app_user_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="App user not found")
    
    if payload.is_disabled is not None:
        user.is_disabled = payload.is_disabled
    if payload.is_email_verified is not None:
        user.is_email_verified = payload.is_email_verified
    
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{app_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_app_user(
    app_user_id: str,
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Delete an app user (admin only)."""
    from fastapi import HTTPException
    
    user = db.query(AppUser).filter(
        AppUser.project_id == project.id,
        AppUser.id == app_user_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="App user not found")
    
    db.delete(user)
    db.commit()
    return None


@router.post("/users/{app_user_id}/revoke-sessions", status_code=status.HTTP_204_NO_CONTENT)
def revoke_app_user_sessions(
    app_user_id: str,
    project: Project = Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Revoke all sessions for an app user (admin only)."""
    from fastapi import HTTPException
    
    user = db.query(AppUser).filter(
        AppUser.project_id == project.id,
        AppUser.id == app_user_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="App user not found")
    
    app_auth.logout_all_app_user_sessions(db, user)
    return None
