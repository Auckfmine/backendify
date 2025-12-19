from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api import deps
from app.api.deps import Principal
from app.models.collection import Collection
from app.models.field import Field
from app.models.project import Project
from app.services.audit_service import log_audit_event
from app.services.collections import get_collection
from app.services.crud_service import (
    count_records,
    delete_record,
    get_record_by_id,
    insert_record,
    list_records,
    update_record,
)
from app.services.policy_service import check_permission_for_principal
from app.services.validation_service import validate_record
from app.services.webhook_service import emit_event

router = APIRouter()


def _get_hidden_fields(db: Session, collection: Collection) -> set[str]:
    """Get the set of hidden field names for a collection."""
    hidden_fields = db.query(Field).filter(
        Field.collection_id == collection.id,
        Field.is_hidden == True,
        Field.is_deleted == False,
    ).all()
    return {f.sql_column_name for f in hidden_fields}


def _filter_hidden_fields(record: dict[str, Any], hidden_fields: set[str]) -> dict[str, Any]:
    """Remove hidden fields from a record."""
    if not hidden_fields:
        return record
    return {k: v for k, v in record.items() if k not in hidden_fields}


def _filter_records(records: list[dict[str, Any]], hidden_fields: set[str]) -> list[dict[str, Any]]:
    """Remove hidden fields from a list of records."""
    if not hidden_fields:
        return records
    return [_filter_hidden_fields(r, hidden_fields) for r in records]


def _check_policy(db: Session, collection, action: str, principal: Principal, record: dict | None = None):
    if not check_permission_for_principal(db, collection, action, principal, record):
        if principal.type == "anonymous":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied for action: {action}",
        )


def _validate_data(db: Session, collection, data: dict[str, Any]):
    """Validate data against field validation rules."""
    fields = db.query(Field).filter(
        Field.collection_id == collection.id,
        Field.is_deleted == False,
    ).all()
    
    errors = validate_record(db, fields, data)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"validation_errors": errors},
        )


@router.post("/{collection_name}", status_code=status.HTTP_201_CREATED)
def create_record(
    collection_name: str,
    payload: dict[str, Any],
    request: Request,
    project: Project = Depends(deps.get_project_public),
    principal: Principal = Depends(deps.get_principal),
    db: Session = Depends(deps.get_db),
) -> dict[str, Any]:
    collection = get_collection(db, project, collection_name)
    _check_policy(db, collection, "create", principal)
    _validate_data(db, collection, payload)
    
    # Determine user IDs for tracking
    created_by_user_id = principal.admin_user.id if principal.admin_user else None
    created_by_app_user_id = principal.app_user.id if principal.app_user else None
    
    result = insert_record(
        db,
        project.id,
        collection,
        data=payload,
        created_by_user_id=created_by_user_id,
        created_by_app_user_id=created_by_app_user_id,
    )
    
    log_audit_event(
        db,
        project_id=project.id,
        action="create",
        collection_id=collection.id,
        record_id=str(result.get("id")),
        actor_user_id=principal.admin_user.id if principal.admin_user else None,
        actor_app_user_id=principal.app_user.id if principal.app_user else None,
        new_data=result,
        ip_address=request.client.host if request.client else None,
    )
    
    emit_event(db, project.id, "record.created", {
        "collection": collection_name,
        "record": result,
        "actor_user_id": principal.user_id,
    })
    db.commit()
    
    # Filter hidden fields from response
    hidden_fields = _get_hidden_fields(db, collection)
    return _filter_hidden_fields(result, hidden_fields)


@router.get("/{collection_name}")
def list_collection_records(
    collection_name: str,
    request: Request,
    project: Project = Depends(deps.get_project_public),
    principal: Principal = Depends(deps.get_principal),
    db: Session = Depends(deps.get_db),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    sort: str | None = Query(default=None, description="Sort fields. Prefix with - for DESC. Example: -created_at,name"),
) -> dict[str, Any]:
    """List records with advanced filtering and sorting.
    
    **Filtering:**
    - Simple: `?field=value` (equals)
    - With operator: `?field__operator=value`
    
    **Supported operators:**
    - `eq`, `neq` - equals, not equals
    - `gt`, `gte`, `lt`, `lte` - greater/less than
    - `contains`, `startswith`, `endswith` - string matching
    - `ilike` - case-insensitive contains
    - `in`, `notin` - value in comma-separated list
    - `isnull`, `isnotnull` - null checks
    
    **Sorting:**
    - `?sort=field` - ascending
    - `?sort=-field` - descending
    - `?sort=-created_at,name` - multiple fields
    
    **Examples:**
    - `?price__gte=100&price__lte=500`
    - `?status__in=active,pending`
    - `?name__contains=john`
    - `?sort=-created_at`
    """
    collection = get_collection(db, project, collection_name)
    _check_policy(db, collection, "list", principal)
    
    # Build field map for validating filter params
    fields = db.query(Field).filter(
        Field.collection_id == collection.id,
        Field.is_deleted == False,
    ).all()
    field_map = {f.name: f for f in fields}
    # Also allow lookup by sql_column_name
    for f in fields:
        if f.sql_column_name and f.sql_column_name != f.name:
            field_map[f.sql_column_name] = f
    
    # System columns that can be filtered/sorted
    system_columns = {"created_by_user_id", "created_by_app_user_id", "id", "created_at", "updated_at"}
    
    # For app_user with row-level policies, filter by created_by_app_user_id
    filters: dict[str, Any] = {}
    if principal.type == "app_user" and principal.app_user:
        filters["created_by_app_user_id"] = principal.app_user.id
    
    # Extract filter params from query string (exclude reserved params)
    reserved_params = {"limit", "offset", "sort"}
    
    for key, value in request.query_params.items():
        if key in reserved_params:
            continue
        
        # Parse field name and operator (e.g., "price__gte" -> "price", "gte")
        if "__" in key:
            parts = key.rsplit("__", 1)
            base_field = parts[0]
            operator = parts[1] if len(parts) == 2 else "eq"
        else:
            base_field = key
            operator = "eq"
        
        # Validate field exists
        if base_field in field_map:
            field = field_map[base_field]
            column_name = field.sql_column_name
            
            # Convert value based on field type (for eq operator)
            if operator == "eq":
                if field.field_type == "boolean":
                    value = value.lower() in ("true", "1", "yes")
                elif field.field_type == "int":
                    try:
                        value = int(value)
                    except ValueError:
                        pass
                elif field.field_type == "float":
                    try:
                        value = float(value)
                    except ValueError:
                        pass
            
            # Build filter key with operator
            if operator != "eq":
                filters[f"{column_name}__{operator}"] = value
            else:
                filters[column_name] = value
                
        elif base_field in system_columns:
            if operator != "eq":
                filters[f"{base_field}__{operator}"] = value
            else:
                filters[base_field] = value
    
    # Validate sort fields
    validated_sort = None
    if sort:
        valid_sort_parts = []
        for field in sort.split(","):
            field = field.strip()
            if not field:
                continue
            field_name = field.lstrip("-")
            # Check if it's a valid field or system column
            if field_name in field_map:
                # Use sql_column_name for sorting
                col_name = field_map[field_name].sql_column_name
                valid_sort_parts.append(f"-{col_name}" if field.startswith("-") else col_name)
            elif field_name in system_columns:
                valid_sort_parts.append(field)
        if valid_sort_parts:
            validated_sort = ",".join(valid_sort_parts)
    
    records = list_records(
        db, project.id, collection,
        limit=limit, offset=offset,
        filters=filters if filters else None,
        sort=validated_sort,
    )
    total = count_records(db, project.id, collection, filters=filters if filters else None)
    
    # Filter hidden fields from response
    hidden_fields = _get_hidden_fields(db, collection)
    filtered_records = _filter_records(records, hidden_fields)
    
    return {
        "records": filtered_records,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{collection_name}/{record_id}")
def get_single_record(
    collection_name: str,
    record_id: str,
    project: Project = Depends(deps.get_project_public),
    principal: Principal = Depends(deps.get_principal),
    db: Session = Depends(deps.get_db),
) -> dict[str, Any]:
    collection = get_collection(db, project, collection_name)
    record = get_record_by_id(db, project.id, collection, record_id)
    _check_policy(db, collection, "read", principal, record)
    
    # Filter hidden fields from response
    hidden_fields = _get_hidden_fields(db, collection)
    return _filter_hidden_fields(record, hidden_fields)


@router.patch("/{collection_name}/{record_id}")
def update_single_record(
    collection_name: str,
    record_id: str,
    payload: dict[str, Any],
    request: Request,
    project: Project = Depends(deps.get_project_public),
    principal: Principal = Depends(deps.get_principal),
    db: Session = Depends(deps.get_db),
) -> dict[str, Any]:
    collection = get_collection(db, project, collection_name)
    old_record = get_record_by_id(db, project.id, collection, record_id)
    _check_policy(db, collection, "update", principal, old_record)
    _validate_data(db, collection, payload)
    
    result = update_record(db, project.id, collection, record_id, data=payload)
    
    log_audit_event(
        db,
        project_id=project.id,
        action="update",
        collection_id=collection.id,
        record_id=str(record_id),
        actor_user_id=principal.admin_user.id if principal.admin_user else None,
        actor_app_user_id=principal.app_user.id if principal.app_user else None,
        old_data=old_record,
        new_data=result,
        ip_address=request.client.host if request.client else None,
    )
    
    emit_event(db, project.id, "record.updated", {
        "collection": collection_name,
        "record_id": record_id,
        "old_record": old_record,
        "new_record": result,
        "actor_user_id": principal.user_id,
    })
    db.commit()
    
    # Filter hidden fields from response
    hidden_fields = _get_hidden_fields(db, collection)
    return _filter_hidden_fields(result, hidden_fields)


@router.delete("/{collection_name}/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_single_record(
    collection_name: str,
    record_id: str,
    request: Request,
    project: Project = Depends(deps.get_project_public),
    principal: Principal = Depends(deps.get_principal),
    db: Session = Depends(deps.get_db),
) -> None:
    collection = get_collection(db, project, collection_name)
    old_record = get_record_by_id(db, project.id, collection, record_id)
    _check_policy(db, collection, "delete", principal, old_record)
    
    delete_record(db, project.id, collection, record_id)
    
    log_audit_event(
        db,
        project_id=project.id,
        action="delete",
        collection_id=collection.id,
        record_id=str(record_id),
        actor_user_id=principal.admin_user.id if principal.admin_user else None,
        actor_app_user_id=principal.app_user.id if principal.app_user else None,
        old_data=old_record,
        ip_address=request.client.host if request.client else None,
    )
    
    emit_event(db, project.id, "record.deleted", {
        "collection": collection_name,
        "record_id": record_id,
        "deleted_record": old_record,
        "actor_user_id": principal.user_id,
    })
    db.commit()
