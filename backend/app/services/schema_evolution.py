"""
Schema Evolution Service - Milestone J
Handles safe schema changes: rename collection/field, drop field, change field type.
"""
import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.collection import Collection
from app.models.collection_alias import CollectionAlias, FieldAlias
from app.models.field import Field
from app.models.project import Project
from app.models.schema_op import SchemaOp
from app.services.schema_manager import (
    FIELD_TYPE_MAP,
    FIELD_TYPE_MAP_SQLITE,
    _is_sqlite,
    get_project_schema_name,
    validate_slug,
)

ALIAS_GRACE_PERIOD_DAYS = 30

SAFE_TYPE_CONVERSIONS = {
    ("int", "float"): "CAST({col} AS double precision)",
    ("string", "text"): None,
    ("date", "datetime"): "CAST({col} AS timestamptz)",
}

SAFE_TYPE_CONVERSIONS_SQLITE = {
    ("int", "float"): "CAST({col} AS REAL)",
    ("string", "text"): None,
    ("date", "datetime"): "{col}",
}


def _acquire_advisory_lock(db: Session, project_id: str, collection_id: str | None = None) -> bool:
    """Acquire Postgres advisory lock for DDL operations. Returns True if acquired."""
    if _is_sqlite(db):
        return True
    
    lock_key = hash(f"{project_id}:{collection_id or 'project'}") % (2**31)
    result = db.execute(text("SELECT pg_try_advisory_lock(:key)"), {"key": lock_key}).scalar()
    return result


def _release_advisory_lock(db: Session, project_id: str, collection_id: str | None = None) -> None:
    """Release Postgres advisory lock."""
    if _is_sqlite(db):
        return
    
    lock_key = hash(f"{project_id}:{collection_id or 'project'}") % (2**31)
    db.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": lock_key})


def rename_collection(
    db: Session,
    project: Project,
    collection: Collection,
    new_name: str,
    new_display_name: str | None = None,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    """
    Rename a collection (table) with alias support for backward compatibility.
    J1: Rename collection (table rename)
    """
    if not validate_slug(new_name):
        raise ValueError(f"Invalid collection name: {new_name}")
    
    if not _acquire_advisory_lock(db, project.id, collection.id):
        raise RuntimeError("Could not acquire lock for schema change")
    
    try:
        old_name = collection.name
        old_sql_table_name = collection.sql_table_name
        new_sql_table_name = new_name
        schema_name = get_project_schema_name(project.id)
        
        if _is_sqlite(db):
            old_table = f'"coll_{old_sql_table_name}"'
            new_table = f'"coll_{new_sql_table_name}"'
            rename_sql = text(f'ALTER TABLE {old_table} RENAME TO "coll_{new_sql_table_name}"')
        else:
            old_table = f'"{schema_name}"."{old_sql_table_name}"'
            rename_sql = text(f'ALTER TABLE {old_table} RENAME TO "{new_sql_table_name}"')
        
        db.execute(rename_sql)
        
        alias = CollectionAlias(
            collection_id=collection.id,
            project_id=project.id,
            old_name=old_name,
            expires_at=datetime.utcnow() + timedelta(days=ALIAS_GRACE_PERIOD_DAYS),
        )
        db.add(alias)
        
        collection.name = new_name
        collection.sql_table_name = new_sql_table_name
        if new_display_name:
            collection.display_name = new_display_name
        
        op = SchemaOp(
            project_id=project.id,
            collection_id=collection.id,
            op_type="rename_table",
            payload_json=json.dumps({
                "old_name": old_name,
                "new_name": new_name,
                "old_sql_table_name": old_sql_table_name,
                "new_sql_table_name": new_sql_table_name,
                "alias_expires_at": alias.expires_at.isoformat(),
            }),
            status="applied",
            actor_user_id=actor_user_id,
        )
        db.add(op)
        db.commit()
        
        return {
            "old_name": old_name,
            "new_name": new_name,
            "alias_expires_at": alias.expires_at.isoformat(),
        }
    finally:
        _release_advisory_lock(db, project.id, collection.id)


def rename_field(
    db: Session,
    project: Project,
    collection: Collection,
    field: Field,
    new_name: str,
    new_display_name: str | None = None,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    """
    Rename a field (column) with alias support for backward compatibility.
    J2: Rename field (column rename)
    """
    if not validate_slug(new_name):
        raise ValueError(f"Invalid field name: {new_name}")
    
    if not _acquire_advisory_lock(db, project.id, collection.id):
        raise RuntimeError("Could not acquire lock for schema change")
    
    try:
        old_name = field.name
        old_sql_column_name = field.sql_column_name
        new_sql_column_name = new_name
        schema_name = get_project_schema_name(project.id)
        table_name = collection.sql_table_name
        
        if _is_sqlite(db):
            target_table = f'"coll_{table_name}"'
        else:
            target_table = f'"{schema_name}"."{table_name}"'
        
        rename_sql = text(
            f'ALTER TABLE {target_table} RENAME COLUMN "{old_sql_column_name}" TO "{new_sql_column_name}"'
        )
        db.execute(rename_sql)
        
        alias = FieldAlias(
            field_id=field.id,
            collection_id=collection.id,
            old_name=old_name,
            expires_at=datetime.utcnow() + timedelta(days=ALIAS_GRACE_PERIOD_DAYS),
        )
        db.add(alias)
        
        field.name = new_name
        field.sql_column_name = new_sql_column_name
        if new_display_name:
            field.display_name = new_display_name
        
        op = SchemaOp(
            project_id=project.id,
            collection_id=collection.id,
            op_type="rename_column",
            payload_json=json.dumps({
                "field_id": field.id,
                "old_name": old_name,
                "new_name": new_name,
                "old_sql_column_name": old_sql_column_name,
                "new_sql_column_name": new_sql_column_name,
                "alias_expires_at": alias.expires_at.isoformat(),
            }),
            status="applied",
            actor_user_id=actor_user_id,
        )
        db.add(op)
        db.commit()
        
        return {
            "old_name": old_name,
            "new_name": new_name,
            "alias_expires_at": alias.expires_at.isoformat(),
        }
    finally:
        _release_advisory_lock(db, project.id, collection.id)


def soft_delete_field(
    db: Session,
    project: Project,
    collection: Collection,
    field: Field,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    """
    Soft delete a field - hide from UI and block writes, but keep data.
    J3: Drop field (soft drop first)
    """
    if field.is_deleted:
        raise ValueError("Field is already deleted")
    
    if not _acquire_advisory_lock(db, project.id, collection.id):
        raise RuntimeError("Could not acquire lock for schema change")
    
    try:
        field.is_deleted = True
        field.deleted_at = datetime.utcnow()
        
        op = SchemaOp(
            project_id=project.id,
            collection_id=collection.id,
            op_type="soft_delete_column",
            payload_json=json.dumps({
                "field_id": field.id,
                "field_name": field.name,
                "sql_column_name": field.sql_column_name,
                "deleted_at": field.deleted_at.isoformat(),
            }),
            status="applied",
            actor_user_id=actor_user_id,
        )
        db.add(op)
        db.commit()
        
        return {
            "field_id": field.id,
            "field_name": field.name,
            "deleted_at": field.deleted_at.isoformat(),
        }
    finally:
        _release_advisory_lock(db, project.id, collection.id)


def hard_delete_field(
    db: Session,
    project: Project,
    collection: Collection,
    field: Field,
    actor_user_id: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """
    Physically drop a field column from the database.
    J3: Drop field - Phase 2 (admin-only)
    """
    if not field.is_deleted and not force:
        raise ValueError("Field must be soft-deleted first. Use force=True to skip.")
    
    if not _acquire_advisory_lock(db, project.id, collection.id):
        raise RuntimeError("Could not acquire lock for schema change")
    
    try:
        schema_name = get_project_schema_name(project.id)
        table_name = collection.sql_table_name
        column_name = field.sql_column_name
        
        if _is_sqlite(db):
            target_table = f'"coll_{table_name}"'
        else:
            target_table = f'"{schema_name}"."{table_name}"'
        
        drop_sql = text(f'ALTER TABLE {target_table} DROP COLUMN "{column_name}"')
        db.execute(drop_sql)
        
        op = SchemaOp(
            project_id=project.id,
            collection_id=collection.id,
            op_type="drop_column",
            payload_json=json.dumps({
                "field_id": field.id,
                "field_name": field.name,
                "sql_column_name": column_name,
            }),
            status="applied",
            actor_user_id=actor_user_id,
        )
        db.add(op)
        
        db.delete(field)
        db.commit()
        
        return {
            "field_id": field.id,
            "field_name": field.name,
            "dropped": True,
        }
    finally:
        _release_advisory_lock(db, project.id, collection.id)


def restore_field(
    db: Session,
    project: Project,
    collection: Collection,
    field: Field,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    """Restore a soft-deleted field."""
    if not field.is_deleted:
        raise ValueError("Field is not deleted")
    
    field.is_deleted = False
    field.deleted_at = None
    
    op = SchemaOp(
        project_id=project.id,
        collection_id=collection.id,
        op_type="restore_column",
        payload_json=json.dumps({
            "field_id": field.id,
            "field_name": field.name,
        }),
        status="applied",
        actor_user_id=actor_user_id,
    )
    db.add(op)
    db.commit()
    
    return {
        "field_id": field.id,
        "field_name": field.name,
        "restored": True,
    }


def is_safe_type_conversion(from_type: str, to_type: str) -> bool:
    """Check if a type conversion is safe (no data loss)."""
    if from_type == to_type:
        return True
    return (from_type, to_type) in SAFE_TYPE_CONVERSIONS


def change_field_type(
    db: Session,
    project: Project,
    collection: Collection,
    field: Field,
    new_type: str,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    """
    Change field type (safe conversions only).
    J4: Change field type (safe conversions only)
    """
    old_type = field.field_type
    
    if old_type == new_type:
        raise ValueError("New type is the same as current type")
    
    if not is_safe_type_conversion(old_type, new_type):
        raise ValueError(
            f"Unsafe type conversion from {old_type} to {new_type}. "
            "Use the migration wizard for complex conversions."
        )
    
    if not _acquire_advisory_lock(db, project.id, collection.id):
        raise RuntimeError("Could not acquire lock for schema change")
    
    try:
        schema_name = get_project_schema_name(project.id)
        table_name = collection.sql_table_name
        column_name = field.sql_column_name
        
        is_sqlite = _is_sqlite(db)
        
        if is_sqlite:
            target_table = f'"coll_{table_name}"'
            new_sql_type = FIELD_TYPE_MAP_SQLITE.get(new_type, "TEXT")
            conversion = SAFE_TYPE_CONVERSIONS_SQLITE.get((old_type, new_type))
        else:
            target_table = f'"{schema_name}"."{table_name}"'
            new_sql_type = FIELD_TYPE_MAP.get(new_type, "text")
            conversion = SAFE_TYPE_CONVERSIONS.get((old_type, new_type))
        
        if conversion is None:
            alter_sql = text(
                f'ALTER TABLE {target_table} ALTER COLUMN "{column_name}" TYPE {new_sql_type}'
            )
        else:
            cast_expr = conversion.format(col=f'"{column_name}"')
            alter_sql = text(
                f'ALTER TABLE {target_table} ALTER COLUMN "{column_name}" TYPE {new_sql_type} USING {cast_expr}'
            )
        
        if not is_sqlite:
            db.execute(alter_sql)
        
        field.field_type = new_type
        
        op = SchemaOp(
            project_id=project.id,
            collection_id=collection.id,
            op_type="change_column_type",
            payload_json=json.dumps({
                "field_id": field.id,
                "field_name": field.name,
                "old_type": old_type,
                "new_type": new_type,
            }),
            status="applied",
            actor_user_id=actor_user_id,
        )
        db.add(op)
        db.commit()
        
        return {
            "field_id": field.id,
            "field_name": field.name,
            "old_type": old_type,
            "new_type": new_type,
        }
    finally:
        _release_advisory_lock(db, project.id, collection.id)


def preview_migration(
    db: Session,
    project: Project,
    collection: Collection,
    operation: str,
    params: dict[str, Any],
) -> dict[str, Any]:
    """
    Generate a preview of DDL steps for a schema change.
    J5: Migration preview + "apply" step
    """
    schema_name = get_project_schema_name(project.id)
    table_name = collection.sql_table_name
    is_sqlite = _is_sqlite(db)
    
    if is_sqlite:
        target_table = f'"coll_{table_name}"'
    else:
        target_table = f'"{schema_name}"."{table_name}"'
    
    steps = []
    warnings = []
    
    if operation == "rename_collection":
        new_name = params.get("new_name")
        if not new_name:
            raise ValueError("new_name is required")
        
        if is_sqlite:
            steps.append(f'ALTER TABLE {target_table} RENAME TO "coll_{new_name}"')
        else:
            steps.append(f'ALTER TABLE {target_table} RENAME TO "{new_name}"')
        
        warnings.append(f"Old name '{collection.name}' will be aliased for {ALIAS_GRACE_PERIOD_DAYS} days")
    
    elif operation == "rename_field":
        field_id = params.get("field_id")
        new_name = params.get("new_name")
        if not field_id or not new_name:
            raise ValueError("field_id and new_name are required")
        
        field = db.query(Field).filter(Field.id == field_id).first()
        if not field:
            raise ValueError("Field not found")
        
        steps.append(
            f'ALTER TABLE {target_table} RENAME COLUMN "{field.sql_column_name}" TO "{new_name}"'
        )
        warnings.append(f"Old field name '{field.name}' will be aliased for {ALIAS_GRACE_PERIOD_DAYS} days")
    
    elif operation == "soft_delete_field":
        field_id = params.get("field_id")
        if not field_id:
            raise ValueError("field_id is required")
        
        field = db.query(Field).filter(Field.id == field_id).first()
        if not field:
            raise ValueError("Field not found")
        
        steps.append(f"-- Mark field '{field.name}' as deleted in catalog (no DDL)")
        warnings.append("Field will be hidden from UI and writes will be blocked")
        warnings.append("Data is preserved; use hard_delete to remove column")
    
    elif operation == "hard_delete_field":
        field_id = params.get("field_id")
        if not field_id:
            raise ValueError("field_id is required")
        
        field = db.query(Field).filter(Field.id == field_id).first()
        if not field:
            raise ValueError("Field not found")
        
        steps.append(f'ALTER TABLE {target_table} DROP COLUMN "{field.sql_column_name}"')
        warnings.append("THIS WILL PERMANENTLY DELETE ALL DATA IN THIS COLUMN")
        warnings.append("This action cannot be undone")
    
    elif operation == "change_field_type":
        field_id = params.get("field_id")
        new_type = params.get("new_type")
        if not field_id or not new_type:
            raise ValueError("field_id and new_type are required")
        
        field = db.query(Field).filter(Field.id == field_id).first()
        if not field:
            raise ValueError("Field not found")
        
        old_type = field.field_type
        if not is_safe_type_conversion(old_type, new_type):
            warnings.append(f"UNSAFE: Cannot convert {old_type} → {new_type} directly")
            warnings.append("Use migration wizard: create new column, migrate data, swap")
        else:
            new_sql_type = FIELD_TYPE_MAP.get(new_type, "text")
            conversion = SAFE_TYPE_CONVERSIONS.get((old_type, new_type))
            
            if conversion is None:
                steps.append(
                    f'ALTER TABLE {target_table} ALTER COLUMN "{field.sql_column_name}" TYPE {new_sql_type}'
                )
            else:
                cast_expr = conversion.format(col=f'"{field.sql_column_name}"')
                steps.append(
                    f'ALTER TABLE {target_table} ALTER COLUMN "{field.sql_column_name}" TYPE {new_sql_type} USING {cast_expr}'
                )
    
    else:
        raise ValueError(f"Unknown operation: {operation}")
    
    return {
        "operation": operation,
        "collection": collection.name,
        "steps": steps,
        "warnings": warnings,
        "params": params,
    }


def resolve_collection_by_name_or_alias(
    db: Session,
    project_id: str,
    name: str,
) -> Collection | None:
    """Resolve a collection by name or alias (for backward compatibility)."""
    collection = db.query(Collection).filter(
        Collection.project_id == project_id,
        Collection.name == name,
        Collection.is_active == True,
    ).first()
    
    if collection:
        return collection
    
    alias = db.query(CollectionAlias).filter(
        CollectionAlias.project_id == project_id,
        CollectionAlias.old_name == name,
    ).first()
    
    if alias and (alias.expires_at is None or alias.expires_at > datetime.utcnow()):
        return db.query(Collection).filter(Collection.id == alias.collection_id).first()
    
    return None


def resolve_field_by_name_or_alias(
    db: Session,
    collection_id: str,
    name: str,
) -> Field | None:
    """Resolve a field by name or alias (for backward compatibility)."""
    field = db.query(Field).filter(
        Field.collection_id == collection_id,
        Field.name == name,
        Field.is_deleted == False,
    ).first()
    
    if field:
        return field
    
    alias = db.query(FieldAlias).filter(
        FieldAlias.collection_id == collection_id,
        FieldAlias.old_name == name,
    ).first()
    
    if alias and (alias.expires_at is None or alias.expires_at > datetime.utcnow()):
        field = db.query(Field).filter(Field.id == alias.field_id).first()
        if field and not field.is_deleted:
            return field
    
    return None


def get_active_aliases(db: Session, project_id: str) -> dict[str, Any]:
    """Get all active aliases for a project."""
    now = datetime.utcnow()
    
    collection_aliases = db.query(CollectionAlias).filter(
        CollectionAlias.project_id == project_id,
        (CollectionAlias.expires_at == None) | (CollectionAlias.expires_at > now),
    ).all()
    
    field_aliases = db.query(FieldAlias).join(Collection).filter(
        Collection.project_id == project_id,
        (FieldAlias.expires_at == None) | (FieldAlias.expires_at > now),
    ).all()
    
    return {
        "collection_aliases": [
            {
                "old_name": a.old_name,
                "collection_id": a.collection_id,
                "expires_at": a.expires_at.isoformat() if a.expires_at else None,
            }
            for a in collection_aliases
        ],
        "field_aliases": [
            {
                "old_name": a.old_name,
                "field_id": a.field_id,
                "collection_id": a.collection_id,
                "expires_at": a.expires_at.isoformat() if a.expires_at else None,
            }
            for a in field_aliases
        ],
    }
