from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Role, AppUserRole, Project
from app.services.app_user_service import AppUserRecord


# ============== ROLE OPERATIONS ==============

def create_role(
    db: Session,
    project: Project,
    name: str,
    display_name: str,
    description: Optional[str] = None,
    is_default: bool = False,
) -> Role:
    """Create a new role for a project."""
    # Check for duplicate name
    existing = db.execute(
        select(Role).where(Role.project_id == project.id, Role.name == name)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role '{name}' already exists in this project"
        )
    
    # If this is set as default, unset other defaults
    if is_default:
        for role in db.execute(select(Role).where(Role.project_id == project.id, Role.is_default == True)).scalars():
            role.is_default = False
    
    role = Role(
        id=str(uuid4()),
        project_id=project.id,
        name=name,
        display_name=display_name,
        description=description,
        is_default=is_default,
        is_system=False,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def list_roles(db: Session, project: Project) -> List[Role]:
    """List all roles for a project."""
    result = db.execute(
        select(Role)
        .where(Role.project_id == project.id)
        .order_by(Role.is_system.desc(), Role.name)
    )
    return list(result.scalars().all())


def get_role(db: Session, project: Project, role_id: str) -> Role:
    """Get a role by ID."""
    role = db.get(Role, role_id)
    if not role or role.project_id != project.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    return role


def get_role_by_name(db: Session, project: Project, name: str) -> Optional[Role]:
    """Get a role by name."""
    return db.execute(
        select(Role).where(Role.project_id == project.id, Role.name == name)
    ).scalar_one_or_none()


def update_role(
    db: Session,
    role: Role,
    display_name: Optional[str] = None,
    description: Optional[str] = None,
    is_default: Optional[bool] = None,
) -> Role:
    """Update a role."""
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system roles"
        )
    
    if display_name is not None:
        role.display_name = display_name
    if description is not None:
        role.description = description
    if is_default is not None:
        if is_default:
            # Unset other defaults
            for r in db.execute(
                select(Role).where(Role.project_id == role.project_id, Role.is_default == True, Role.id != role.id)
            ).scalars():
                r.is_default = False
        role.is_default = is_default
    
    db.commit()
    db.refresh(role)
    return role


def delete_role(db: Session, role: Role) -> None:
    """Delete a role."""
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete system roles"
        )
    db.delete(role)
    db.commit()


# ============== USER ROLE OPERATIONS ==============

def assign_role_to_user(
    db: Session,
    app_user: AppUserRecord,
    role: Role,
    assigned_by: Optional[str] = None,
) -> AppUserRole:
    """Assign a role to an app user."""
    if app_user.project_id != role.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User and role must belong to the same project"
        )
    
    # Check if already assigned
    existing = db.execute(
        select(AppUserRole).where(
            AppUserRole.app_user_id == app_user.id,
            AppUserRole.role_id == role.id
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Role already assigned to user"
        )
    
    user_role = AppUserRole(
        id=str(uuid4()),
        app_user_id=app_user.id,
        role_id=role.id,
        assigned_by=assigned_by,
    )
    db.add(user_role)
    db.commit()
    db.refresh(user_role)
    return user_role


def remove_role_from_user(db: Session, app_user: AppUserRecord, role: Role) -> None:
    """Remove a role from an app user."""
    user_role = db.execute(
        select(AppUserRole).where(
            AppUserRole.app_user_id == app_user.id,
            AppUserRole.role_id == role.id
        )
    ).scalar_one_or_none()
    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not have this role"
        )
    db.delete(user_role)
    db.commit()


def get_user_roles(db: Session, app_user_id: str) -> List[Role]:
    """Get all roles assigned to an app user by ID."""
    result = db.execute(
        select(Role)
        .join(AppUserRole, AppUserRole.role_id == Role.id)
        .where(AppUserRole.app_user_id == app_user_id)
        .order_by(Role.name)
    )
    return list(result.scalars().all())


def user_has_role(db: Session, app_user_id: str, role_name: str) -> bool:
    """Check if an app user has a specific role."""
    result = db.execute(
        select(AppUserRole)
        .join(Role, Role.id == AppUserRole.role_id)
        .where(
            AppUserRole.app_user_id == app_user_id,
            Role.name == role_name
        )
    ).scalar_one_or_none()
    return result is not None


def user_has_any_role(db: Session, app_user_id: str, role_names: List[str]) -> bool:
    """Check if an app user has any of the specified roles."""
    result = db.execute(
        select(AppUserRole)
        .join(Role, Role.id == AppUserRole.role_id)
        .where(
            AppUserRole.app_user_id == app_user_id,
            Role.name.in_(role_names)
        )
    ).first()
    return result is not None


# ============== DEFAULT ROLE OPERATIONS ==============

def assign_default_role_to_user(db: Session, project_id: str, app_user_id: str) -> Optional[AppUserRole]:
    """Assign the default role to a new app user."""
    from app.services.app_user_service import get_app_user_by_id
    
    default_role = db.execute(
        select(Role).where(
            Role.project_id == project_id,
            Role.is_default == True
        )
    ).scalar_one_or_none()
    
    if default_role:
        app_user = get_app_user_by_id(db, project_id, app_user_id)
        if app_user:
            return assign_role_to_user(db, app_user, default_role, assigned_by="system")
    return None


# ============== SYSTEM ROLE INITIALIZATION ==============

def initialize_default_roles(db: Session, project: Project) -> List[Role]:
    """Create default system roles for a new project."""
    default_roles = [
        {
            "name": "admin",
            "display_name": "Administrator",
            "description": "Full access to all resources",
            "is_system": True,
            "is_default": False,
        },
        {
            "name": "member",
            "display_name": "Member",
            "description": "Standard member access",
            "is_system": True,
            "is_default": True,
        },
        {
            "name": "viewer",
            "display_name": "Viewer",
            "description": "Read-only access",
            "is_system": True,
            "is_default": False,
        },
    ]
    
    created_roles = []
    for role_data in default_roles:
        existing = db.execute(
            select(Role).where(Role.project_id == project.id, Role.name == role_data["name"])
        ).scalar_one_or_none()
        
        if not existing:
            role = Role(
                id=str(uuid4()),
                project_id=project.id,
                **role_data,
            )
            db.add(role)
            created_roles.append(role)
    
    if created_roles:
        db.commit()
        for role in created_roles:
            db.refresh(role)
    
    return created_roles


