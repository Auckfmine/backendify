from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.collection import Collection, USERS_COLLECTION_NAME
from app.models.field import Field
from app.models.project import Project
from app.services.schema_manager import (
    FIELD_TYPE_MAP,
    add_column_to_table,
    create_collection_table,
    ensure_project_schema,
    validate_slug,
)

# Reserved collection names that cannot be created by users
RESERVED_COLLECTION_NAMES = {USERS_COLLECTION_NAME}


def create_collection(
    db: Session,
    project: Project,
    name: str,
    display_name: str,
    actor_user_id: str | None = None,
) -> Collection:
    # Check for reserved names
    if name in RESERVED_COLLECTION_NAMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Collection name '{name}' is reserved for system use.",
        )
    
    if not validate_slug(name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid collection name. Must be lowercase, start with a letter, and contain only letters, numbers, and underscores.",
        )
    
    existing = db.query(Collection).filter(
        Collection.project_id == project.id,
        Collection.name == name,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Collection with this name already exists",
        )
    
    ensure_project_schema(db, project, actor_user_id=actor_user_id)
    
    collection = Collection(
        project_id=project.id,
        name=name,
        display_name=display_name,
        sql_table_name=name,
        is_active=True,
    )
    db.add(collection)
    db.flush()
    
    create_collection_table(db, project, collection, actor_user_id=actor_user_id)
    db.commit()
    db.refresh(collection)
    return collection


def list_collections(db: Session, project: Project) -> list[Collection]:
    return db.query(Collection).filter(
        Collection.project_id == project.id,
        Collection.is_active == True,
    ).all()


def get_collection(db: Session, project: Project, collection_name: str) -> Collection:
    collection = db.query(Collection).filter(
        Collection.project_id == project.id,
        Collection.name == collection_name,
    ).first()
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )
    return collection


def add_field(
    db: Session,
    project: Project,
    collection: Collection,
    name: str,
    display_name: str,
    field_type: str,
    is_required: bool = False,
    is_unique: bool = False,
    is_indexed: bool = False,
    default_value: str | None = None,
    actor_user_id: str | None = None,
) -> Field:
    if not validate_slug(name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid field name. Must be lowercase, start with a letter, and contain only letters, numbers, and underscores.",
        )
    
    if field_type not in FIELD_TYPE_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid field type. Must be one of: {', '.join(FIELD_TYPE_MAP.keys())}",
        )
    
    existing = db.query(Field).filter(
        Field.collection_id == collection.id,
        Field.name == name,
    ).first()
    if existing:
        # Check if trying to modify a system field
        if existing.is_system:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Field '{name}' is a system field and cannot be modified.",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Field with this name already exists",
        )
    
    if is_required and default_value is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Required fields must have a default value for existing rows",
        )
    
    field = Field(
        collection_id=collection.id,
        name=name,
        display_name=display_name,
        field_type=field_type,
        sql_column_name=name,
        is_required=is_required,
        is_unique=is_unique,
        is_indexed=is_indexed,
        default_value=default_value,
        is_system=False,
        is_hidden=False,
    )
    db.add(field)
    db.flush()
    
    add_column_to_table(db, project, collection, field, actor_user_id=actor_user_id)
    db.commit()
    db.refresh(field)
    return field


def delete_field(
    db: Session,
    collection: Collection,
    field_name: str,
) -> None:
    """Soft delete a field (mark as deleted)."""
    field = db.query(Field).filter(
        Field.collection_id == collection.id,
        Field.name == field_name,
        Field.is_deleted == False,
    ).first()
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found",
        )
    
    if field.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field '{field_name}' is a system field and cannot be deleted.",
        )
    
    from datetime import datetime
    field.is_deleted = True
    field.deleted_at = datetime.utcnow()
    db.commit()


def list_fields(db: Session, collection: Collection, include_hidden: bool = False) -> list[Field]:
    """List fields for a collection.
    
    Args:
        db: Database session
        collection: The collection to list fields for
        include_hidden: If False (default), hidden fields like password_hash are excluded
    """
    query = db.query(Field).filter(
        Field.collection_id == collection.id,
        Field.is_deleted == False,
    )
    if not include_hidden:
        query = query.filter(Field.is_hidden == False)
    return query.all()
