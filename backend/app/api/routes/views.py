"""
Views API Routes - Milestone L
"""
import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.schemas.view import ViewCreate, ViewUpdate, ViewExecuteRequest
from app.services import view_service

router = APIRouter()


@router.post("", status_code=status.HTTP_201_CREATED)
def create_view(
    request: ViewCreate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new view (saved query)."""
    try:
        view = view_service.create_view(
            db=db,
            project=project,
            name=request.name,
            display_name=request.display_name,
            base_collection_id=request.base_collection_id,
            description=request.description,
            projection=request.projection,
            filters=[f.model_dump() for f in request.filters] if request.filters else None,
            sorts=[s.model_dump() for s in request.sorts] if request.sorts else None,
            joins=[j.model_dump() for j in request.joins] if request.joins else None,
            params_schema=request.params_schema,
            default_limit=request.default_limit,
            max_limit=request.max_limit,
            actor_user_id=current_user.id,
        )
        return _view_to_dict(view)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("")
def list_views(
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """List all views for a project."""
    views = view_service.list_views(db, project.id)
    return [_view_to_dict(v) for v in views]


@router.get("/operators")
def get_operators(
    project=Depends(deps.get_project_member),
):
    """Get available filter operators."""
    return {"operators": view_service.get_available_operators()}


@router.get("/{view_name}")
def get_view(
    view_name: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Get a view by name."""
    view = view_service.get_view(db, project.id, view_name)
    if not view:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="View not found")
    return _view_to_dict(view)


@router.patch("/{view_name}")
def update_view(
    view_name: str,
    request: ViewUpdate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update a view."""
    view = view_service.get_view(db, project.id, view_name)
    if not view:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="View not found")
    
    try:
        updated = view_service.update_view(
            db=db,
            view=view,
            projection=request.projection,
            filters=[f.model_dump() for f in request.filters] if request.filters else None,
            sorts=[s.model_dump() for s in request.sorts] if request.sorts else None,
            joins=[j.model_dump() for j in request.joins] if request.joins else None,
            params_schema=request.params_schema,
            display_name=request.display_name,
            description=request.description,
            actor_user_id=current_user.id,
        )
        return _view_to_dict(updated)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{view_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_view(
    view_name: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Delete a view."""
    view = view_service.get_view(db, project.id, view_name)
    if not view:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="View not found")
    
    view_service.delete_view(db, view)


@router.get("/{view_name}/versions")
def get_view_versions(
    view_name: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Get all versions of a view."""
    view = view_service.get_view(db, project.id, view_name)
    if not view:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="View not found")
    
    versions = view_service.get_view_versions(db, view.id)
    return [
        {
            "id": v.id,
            "view_id": v.view_id,
            "version": v.version,
            "projection": json.loads(v.projection_json) if v.projection_json else None,
            "filters": json.loads(v.filters_json) if v.filters_json else None,
            "sorts": json.loads(v.sorts_json) if v.sorts_json else None,
            "joins": json.loads(v.joins_json) if v.joins_json else None,
            "params_schema": json.loads(v.params_schema_json) if v.params_schema_json else None,
            "created_at": v.created_at.isoformat(),
            "created_by_user_id": v.created_by_user_id,
        }
        for v in versions
    ]


@router.post("/{view_name}/execute")
def execute_view(
    view_name: str,
    request: ViewExecuteRequest,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Execute a view and return results."""
    view = view_service.get_view(db, project.id, view_name)
    if not view:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="View not found")
    
    try:
        result = view_service.execute_view(
            db=db,
            project=project,
            view=view,
            params=request.params,
            limit=request.limit,
            offset=request.offset,
            current_user_id=current_user.id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{view_name}/meta")
def get_view_meta(
    view_name: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """
    Get view metadata for API documentation (L5.2).
    Returns endpoint info, params, filters, sorts, and example requests.
    """
    view = view_service.get_view(db, project.id, view_name)
    if not view:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="View not found")
    
    return view_service.get_view_meta(db, project, view)


def _view_to_dict(view) -> dict:
    """Convert a View model to a dictionary."""
    return {
        "id": view.id,
        "name": view.name,
        "display_name": view.display_name,
        "description": view.description,
        "base_collection_id": view.base_collection_id,
        "projection": json.loads(view.projection_json) if view.projection_json else None,
        "filters": json.loads(view.filters_json) if view.filters_json else None,
        "sorts": json.loads(view.sorts_json) if view.sorts_json else None,
        "joins": json.loads(view.joins_json) if view.joins_json else None,
        "params_schema": json.loads(view.params_schema_json) if view.params_schema_json else None,
        "default_limit": view.default_limit,
        "max_limit": view.max_limit,
        "version": view.version,
        "is_active": view.is_active,
        "created_at": view.created_at.isoformat(),
        "updated_at": view.updated_at.isoformat(),
    }
