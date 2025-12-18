"""
Schema Evolution API Routes - Milestone J
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.collection import Collection
from app.models.field import Field
from app.models.user import User
from app.schemas.schema_evolution import (
    ChangeFieldTypeRequest,
    PreviewMigrationRequest,
    PreviewMigrationResponse,
    RenameCollectionRequest,
    RenameFieldRequest,
    SchemaOperationResponse,
)
from app.services import schema_evolution as evolution_service

router = APIRouter()


def get_collection_or_404(db: Session, project_id: str, collection_id: str) -> Collection:
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.project_id == project_id,
        Collection.is_active == True,
    ).first()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return collection


def get_field_or_404(db: Session, collection_id: str, field_id: str) -> Field:
    field = db.query(Field).filter(
        Field.id == field_id,
        Field.collection_id == collection_id,
    ).first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")
    return field


@router.post("/collections/{collection_id}/rename", response_model=SchemaOperationResponse)
def rename_collection(
    collection_id: str,
    request: RenameCollectionRequest,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Rename a collection (table) with alias support for backward compatibility."""
    collection = get_collection_or_404(db, project.id, collection_id)
    
    try:
        result = evolution_service.rename_collection(
            db=db,
            project=project,
            collection=collection,
            new_name=request.new_name,
            new_display_name=request.new_display_name,
            actor_user_id=current_user.id,
        )
        return SchemaOperationResponse(
            operation="rename_collection",
            details=result,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/collections/{collection_id}/fields/{field_id}/rename", response_model=SchemaOperationResponse)
def rename_field(
    collection_id: str,
    field_id: str,
    request: RenameFieldRequest,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Rename a field (column) with alias support for backward compatibility."""
    collection = get_collection_or_404(db, project.id, collection_id)
    field = get_field_or_404(db, collection_id, field_id)
    
    try:
        result = evolution_service.rename_field(
            db=db,
            project=project,
            collection=collection,
            field=field,
            new_name=request.new_name,
            new_display_name=request.new_display_name,
            actor_user_id=current_user.id,
        )
        return SchemaOperationResponse(
            operation="rename_field",
            details=result,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/collections/{collection_id}/fields/{field_id}/soft-delete", response_model=SchemaOperationResponse)
def soft_delete_field(
    collection_id: str,
    field_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Soft delete a field - hide from UI and block writes, but keep data."""
    collection = get_collection_or_404(db, project.id, collection_id)
    field = get_field_or_404(db, collection_id, field_id)
    
    try:
        result = evolution_service.soft_delete_field(
            db=db,
            project=project,
            collection=collection,
            field=field,
            actor_user_id=current_user.id,
        )
        return SchemaOperationResponse(
            operation="soft_delete_field",
            details=result,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/collections/{collection_id}/fields/{field_id}/hard-delete", response_model=SchemaOperationResponse)
def hard_delete_field(
    collection_id: str,
    field_id: str,
    force: bool = False,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Physically drop a field column from the database. Requires soft-delete first unless force=True."""
    collection = get_collection_or_404(db, project.id, collection_id)
    field = get_field_or_404(db, collection_id, field_id)
    
    try:
        result = evolution_service.hard_delete_field(
            db=db,
            project=project,
            collection=collection,
            field=field,
            actor_user_id=current_user.id,
            force=force,
        )
        return SchemaOperationResponse(
            operation="hard_delete_field",
            details=result,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/collections/{collection_id}/fields/{field_id}/restore", response_model=SchemaOperationResponse)
def restore_field(
    collection_id: str,
    field_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Restore a soft-deleted field."""
    collection = get_collection_or_404(db, project.id, collection_id)
    field = get_field_or_404(db, collection_id, field_id)
    
    try:
        result = evolution_service.restore_field(
            db=db,
            project=project,
            collection=collection,
            field=field,
            actor_user_id=current_user.id,
        )
        return SchemaOperationResponse(
            operation="restore_field",
            details=result,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/collections/{collection_id}/fields/{field_id}/change-type", response_model=SchemaOperationResponse)
def change_field_type(
    collection_id: str,
    field_id: str,
    request: ChangeFieldTypeRequest,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Change field type (safe conversions only)."""
    collection = get_collection_or_404(db, project.id, collection_id)
    field = get_field_or_404(db, collection_id, field_id)
    
    try:
        result = evolution_service.change_field_type(
            db=db,
            project=project,
            collection=collection,
            field=field,
            new_type=request.new_type,
            actor_user_id=current_user.id,
        )
        return SchemaOperationResponse(
            operation="change_field_type",
            details=result,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/collections/{collection_id}/preview-migration", response_model=PreviewMigrationResponse)
def preview_migration(
    collection_id: str,
    request: PreviewMigrationRequest,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Generate a preview of DDL steps for a schema change."""
    collection = get_collection_or_404(db, project.id, collection_id)
    
    try:
        result = evolution_service.preview_migration(
            db=db,
            project=project,
            collection=collection,
            operation=request.operation,
            params=request.params,
        )
        return PreviewMigrationResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/aliases")
def get_active_aliases(
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Get all active aliases for a project."""
    return evolution_service.get_active_aliases(db, project.id)


@router.get("/safe-conversions")
def get_safe_type_conversions():
    """Get list of safe type conversions."""
    return {
        "safe_conversions": [
            {"from": "int", "to": "float", "description": "Integer to floating point"},
            {"from": "string", "to": "text", "description": "String to text (no-op)"},
            {"from": "date", "to": "datetime", "description": "Date to datetime (midnight UTC)"},
        ]
    }
