"""
Relations API Routes - Milestone K
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.collection import Collection
from app.models.user import User
from app.schemas.relation import RelationFieldCreate, RelationFieldOut
from app.services import relation_service

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


@router.post("/collections/{collection_id}/relations", status_code=status.HTTP_201_CREATED)
def create_relation_field(
    collection_id: str,
    request: RelationFieldCreate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a relation field (foreign key) linking to another collection."""
    collection = get_collection_or_404(db, project.id, collection_id)
    
    target_collection = db.query(Collection).filter(
        Collection.id == request.target_collection_id,
        Collection.project_id == project.id,
        Collection.is_active == True,
    ).first()
    
    if not target_collection:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target collection not found"
        )
    
    try:
        field = relation_service.create_relation_field(
            db=db,
            project=project,
            collection=collection,
            name=request.name,
            display_name=request.display_name,
            target_collection=target_collection,
            relation_type=request.relation_type,
            on_delete=request.on_delete,
            display_field=request.display_field,
            is_required=request.is_required,
            actor_user_id=current_user.id,
        )
        return {
            "id": field.id,
            "name": field.name,
            "display_name": field.display_name,
            "field_type": field.field_type,
            "sql_column_name": field.sql_column_name,
            "is_required": field.is_required,
            "relation_target_collection_id": field.relation_target_collection_id,
            "relation_type": field.relation_type,
            "relation_on_delete": field.relation_on_delete,
            "relation_display_field": field.relation_display_field,
            "target_collection_name": target_collection.name,
            "created_at": field.created_at.isoformat(),
            "updated_at": field.updated_at.isoformat(),
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/collections/{collection_id}/relations")
def list_relation_fields(
    collection_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """List all relation fields for a collection."""
    collection = get_collection_or_404(db, project.id, collection_id)
    
    fields = relation_service.get_relation_fields(db, collection.id)
    
    result = []
    for field in fields:
        target_collection = db.query(Collection).filter(
            Collection.id == field.relation_target_collection_id
        ).first()
        
        result.append({
            "id": field.id,
            "name": field.name,
            "display_name": field.display_name,
            "field_type": field.field_type,
            "sql_column_name": field.sql_column_name,
            "is_required": field.is_required,
            "relation_target_collection_id": field.relation_target_collection_id,
            "relation_type": field.relation_type,
            "relation_on_delete": field.relation_on_delete,
            "relation_display_field": field.relation_display_field,
            "target_collection_name": target_collection.name if target_collection else None,
            "created_at": field.created_at.isoformat(),
            "updated_at": field.updated_at.isoformat(),
        })
    
    return result


@router.get("/collections/{collection_id}/reverse-relations")
def list_reverse_relations(
    collection_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """List all fields from other collections that reference this collection (one_to_many derived)."""
    collection = get_collection_or_404(db, project.id, collection_id)
    
    fields = relation_service.get_reverse_relations(db, collection.id)
    
    result = []
    for field in fields:
        source_collection = db.query(Collection).filter(
            Collection.id == field.collection_id
        ).first()
        
        result.append({
            "id": field.id,
            "name": field.name,
            "display_name": field.display_name,
            "source_collection_id": field.collection_id,
            "source_collection_name": source_collection.name if source_collection else None,
            "relation_type": "one_to_many",
            "sql_column_name": field.sql_column_name,
        })
    
    return result


@router.get("/relation-options")
def get_relation_options(
    project=Depends(deps.get_project_member),
):
    """Get available relation types and on_delete actions."""
    return {
        "relation_types": [
            {"value": "many_to_one", "label": "Many to One", "description": "e.g., Order → Customer"},
        ],
        "on_delete_actions": [
            {"value": "RESTRICT", "label": "Restrict", "description": "Prevent deletion if referenced"},
            {"value": "CASCADE", "label": "Cascade", "description": "Delete related records"},
            {"value": "SET NULL", "label": "Set Null", "description": "Set reference to null"},
        ],
    }
