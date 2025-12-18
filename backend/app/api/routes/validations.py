"""
Validations API Routes - Milestone M
"""
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.collection import Collection
from app.models.field import Field
from app.models.user import User
from app.models.validation_rule import ValidationRule
from app.schemas.validation import ValidationRuleCreate, ValidationRuleUpdate, ValidateRequest
from app.services import validation_service

router = APIRouter()


def get_field_or_404(db: Session, project_id: str, collection_name: str, field_name: str) -> tuple[Collection, Field]:
    collection = db.query(Collection).filter(
        Collection.project_id == project_id,
        Collection.name == collection_name,
        Collection.is_active == True,
    ).first()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    
    field = db.query(Field).filter(
        Field.collection_id == collection.id,
        Field.name == field_name,
        Field.is_deleted == False,
    ).first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")
    
    return collection, field


@router.post("/collections/{collection_name}/fields/{field_name}/rules", status_code=status.HTTP_201_CREATED)
def create_validation_rule(
    collection_name: str,
    field_name: str,
    request: ValidationRuleCreate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Create a validation rule for a field."""
    collection, field = get_field_or_404(db, project.id, collection_name, field_name)
    
    try:
        rule = validation_service.create_validation_rule(
            db=db,
            field=field,
            rule_type=request.rule_type,
            config=request.config,
            error_message=request.error_message,
            priority=request.priority,
        )
        return _rule_to_dict(rule)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/collections/{collection_name}/fields/{field_name}/rules")
def list_validation_rules(
    collection_name: str,
    field_name: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """List all validation rules for a field."""
    collection, field = get_field_or_404(db, project.id, collection_name, field_name)
    rules = validation_service.get_field_rules(db, field.id)
    return [_rule_to_dict(r) for r in rules]


@router.patch("/rules/{rule_id}")
def update_validation_rule(
    rule_id: str,
    request: ValidationRuleUpdate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Update a validation rule."""
    rule = db.query(ValidationRule).filter(ValidationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    
    field = db.query(Field).filter(Field.id == rule.field_id).first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")
    
    collection = db.query(Collection).filter(Collection.id == field.collection_id).first()
    if not collection or collection.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    
    updated = validation_service.update_validation_rule(
        db=db,
        rule=rule,
        config=request.config,
        error_message=request.error_message,
        priority=request.priority,
        is_active=request.is_active,
    )
    return _rule_to_dict(updated)


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_validation_rule(
    rule_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Delete a validation rule."""
    rule = db.query(ValidationRule).filter(ValidationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    
    field = db.query(Field).filter(Field.id == rule.field_id).first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")
    
    collection = db.query(Collection).filter(Collection.id == field.collection_id).first()
    if not collection or collection.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    
    validation_service.delete_validation_rule(db, rule)


@router.post("/collections/{collection_name}/validate")
def validate_record(
    collection_name: str,
    request: ValidateRequest,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    """Validate a record against all field rules."""
    collection = db.query(Collection).filter(
        Collection.project_id == project.id,
        Collection.name == collection_name,
        Collection.is_active == True,
    ).first()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    
    fields = db.query(Field).filter(
        Field.collection_id == collection.id,
        Field.is_deleted == False,
    ).all()
    
    errors = validation_service.validate_record(db, fields, request.data)
    
    return {
        "is_valid": len(errors) == 0,
        "errors": errors,
    }


@router.get("/rule-types")
def get_rule_types(
    project=Depends(deps.get_project_member),
):
    """Get available validation rule types."""
    return {"rule_types": validation_service.get_available_rule_types()}


def _rule_to_dict(rule: ValidationRule) -> dict:
    """Convert a ValidationRule model to a dictionary."""
    return {
        "id": rule.id,
        "field_id": rule.field_id,
        "rule_type": rule.rule_type,
        "config": json.loads(rule.config_json) if rule.config_json else None,
        "error_message": rule.error_message,
        "priority": rule.priority,
        "is_active": rule.is_active,
        "created_at": rule.created_at.isoformat(),
        "updated_at": rule.updated_at.isoformat(),
    }
