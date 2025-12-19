from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas.role import (
    RoleCreate, RoleUpdate, RoleOut,
    AssignRolesRequest, UserRolesOut,
)
from app.services import rbac_service
from app.services.app_user_service import get_app_user_by_id

router = APIRouter()


# ============== ROLE ENDPOINTS ==============

@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Create a new role for the project."""
    return rbac_service.create_role(
        db,
        project,
        name=payload.name,
        display_name=payload.display_name,
        description=payload.description,
        is_default=payload.is_default,
    )


@router.get("/roles", response_model=list[RoleOut])
def list_roles(
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """List all roles for the project."""
    return rbac_service.list_roles(db, project)


@router.get("/roles/{role_id}", response_model=RoleOut)
def get_role(
    role_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Get a role by ID."""
    return rbac_service.get_role(db, project, role_id)


@router.patch("/roles/{role_id}", response_model=RoleOut)
def update_role(
    role_id: str,
    payload: RoleUpdate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Update a role."""
    role = rbac_service.get_role(db, project, role_id)
    return rbac_service.update_role(
        db,
        role,
        display_name=payload.display_name,
        description=payload.description,
        is_default=payload.is_default,
    )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Delete a role."""
    role = rbac_service.get_role(db, project, role_id)
    rbac_service.delete_role(db, role)


# ============== USER ROLE ENDPOINTS ==============

@router.get("/users/{user_id}/roles", response_model=UserRolesOut)
def get_user_roles(
    user_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Get all roles assigned to an app user."""
    app_user = get_app_user_by_id(db, project.id, user_id)
    if not app_user:
        raise HTTPException(status_code=404, detail="App user not found")
    roles = rbac_service.get_user_roles(db, user_id)
    return UserRolesOut(app_user_id=user_id, roles=roles)


@router.post("/users/{user_id}/roles", response_model=UserRolesOut, status_code=status.HTTP_201_CREATED)
def assign_roles_to_user(
    user_id: str,
    payload: AssignRolesRequest,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Assign roles to an app user."""
    app_user = get_app_user_by_id(db, project.id, user_id)
    if not app_user:
        raise HTTPException(status_code=404, detail="App user not found")
    
    for role_id in payload.role_ids:
        role = rbac_service.get_role(db, project, role_id)
        try:
            rbac_service.assign_role_to_user(db, app_user, role, assigned_by="admin")
        except Exception:
            # Skip if already assigned
            pass
    
    roles = rbac_service.get_user_roles(db, user_id)
    return UserRolesOut(app_user_id=user_id, roles=roles)


@router.delete("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_role_from_user(
    user_id: str,
    role_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Remove a role from an app user."""
    app_user = get_app_user_by_id(db, project.id, user_id)
    if not app_user:
        raise HTTPException(status_code=404, detail="App user not found")
    role = rbac_service.get_role(db, project, role_id)
    rbac_service.remove_role_from_user(db, app_user, role)


# ============== INITIALIZATION ENDPOINTS ==============

@router.post("/initialize", status_code=status.HTTP_201_CREATED)
def initialize_rbac(
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Initialize default roles for a project."""
    roles = rbac_service.initialize_default_roles(db, project)
    return {
        "roles_created": len(roles),
    }
