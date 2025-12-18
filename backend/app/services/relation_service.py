"""
Relation Service - Milestone K
Handles creation and management of relation fields (foreign keys).
"""
import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.collection import Collection
from app.models.field import Field
from app.models.project import Project
from app.models.schema_op import SchemaOp
from app.services.schema_manager import (
    FIELD_TYPE_MAP,
    _is_sqlite,
    get_project_schema_name,
    validate_slug,
)

VALID_RELATION_TYPES = ["many_to_one"]
VALID_ON_DELETE_ACTIONS = ["RESTRICT", "CASCADE", "SET NULL"]


def create_relation_field(
    db: Session,
    project: Project,
    collection: Collection,
    name: str,
    display_name: str,
    target_collection: Collection,
    relation_type: str = "many_to_one",
    on_delete: str = "RESTRICT",
    display_field: str | None = None,
    is_required: bool = False,
    actor_user_id: str | None = None,
) -> Field:
    """
    Create a relation field (foreign key) linking to another collection.
    K1: Field type `relation` - many_to_one
    """
    if not validate_slug(name):
        raise ValueError(f"Invalid field name: {name}")
    
    if relation_type not in VALID_RELATION_TYPES:
        raise ValueError(f"Invalid relation type: {relation_type}. Must be one of {VALID_RELATION_TYPES}")
    
    if on_delete not in VALID_ON_DELETE_ACTIONS:
        raise ValueError(f"Invalid on_delete action: {on_delete}. Must be one of {VALID_ON_DELETE_ACTIONS}")
    
    if collection.id == target_collection.id:
        raise ValueError("Cannot create self-referencing relation in v1")
    
    sql_column_name = f"{name}_id"
    
    field = Field(
        collection_id=collection.id,
        name=name,
        display_name=display_name,
        field_type="relation",
        sql_column_name=sql_column_name,
        is_required=is_required,
        is_indexed=True,
        relation_target_collection_id=target_collection.id,
        relation_type=relation_type,
        relation_on_delete=on_delete,
        relation_display_field=display_field,
    )
    db.add(field)
    db.flush()
    
    _create_fk_column(db, project, collection, target_collection, field, actor_user_id)
    
    db.commit()
    db.refresh(field)
    return field


def _create_fk_column(
    db: Session,
    project: Project,
    collection: Collection,
    target_collection: Collection,
    field: Field,
    actor_user_id: str | None = None,
) -> None:
    """Create the foreign key column in the database."""
    schema_name = get_project_schema_name(project.id)
    table_name = collection.sql_table_name
    target_table_name = target_collection.sql_table_name
    column_name = field.sql_column_name
    
    is_sqlite = _is_sqlite(db)
    
    if is_sqlite:
        target_table = f'"coll_{table_name}"'
        sql_type = "INTEGER"
        nullable = "NULL" if not field.is_required else "NOT NULL"
        
        alter_sql = text(f'ALTER TABLE {target_table} ADD COLUMN "{column_name}" {sql_type} {nullable}')
        db.execute(alter_sql)
        
        idx_name = f"ix_{table_name}_{column_name}"
        index_sql = text(f'CREATE INDEX "{idx_name}" ON {target_table} ("{column_name}")')
        db.execute(index_sql)
    else:
        target_table = f'"{schema_name}"."{table_name}"'
        target_ref = f'"{schema_name}"."{target_table_name}"'
        sql_type = "bigint"
        nullable = "NULL" if not field.is_required else "NOT NULL"
        
        alter_sql = text(f'ALTER TABLE {target_table} ADD COLUMN "{column_name}" {sql_type} {nullable}')
        db.execute(alter_sql)
        
        idx_name = f"ix_{table_name}_{column_name}"
        index_sql = text(f'CREATE INDEX "{idx_name}" ON {target_table} ("{column_name}")')
        db.execute(index_sql)
        
        fk_name = f"fk_{table_name}_{column_name}"
        on_delete = field.relation_on_delete or "RESTRICT"
        fk_sql = text(
            f'ALTER TABLE {target_table} ADD CONSTRAINT "{fk_name}" '
            f'FOREIGN KEY ("{column_name}") REFERENCES {target_ref} (id) ON DELETE {on_delete}'
        )
        db.execute(fk_sql)
    
    op = SchemaOp(
        project_id=project.id,
        collection_id=collection.id,
        op_type="add_relation_column",
        payload_json=json.dumps({
            "table_name": table_name,
            "column_name": column_name,
            "target_collection_id": target_collection.id,
            "target_table_name": target_table_name,
            "relation_type": field.relation_type,
            "on_delete": field.relation_on_delete,
        }),
        status="applied",
        actor_user_id=actor_user_id,
    )
    db.add(op)


def get_relation_fields(db: Session, collection_id: str) -> list[Field]:
    """Get all relation fields for a collection."""
    return db.query(Field).filter(
        Field.collection_id == collection_id,
        Field.field_type == "relation",
        Field.is_deleted == False,
    ).all()


def get_reverse_relations(db: Session, collection_id: str) -> list[Field]:
    """Get all fields from other collections that reference this collection (one_to_many derived)."""
    return db.query(Field).filter(
        Field.relation_target_collection_id == collection_id,
        Field.field_type == "relation",
        Field.is_deleted == False,
    ).all()


def expand_relation(
    db: Session,
    project: Project,
    collection: Collection,
    record: dict[str, Any],
    include_fields: list[str],
) -> dict[str, Any]:
    """
    Expand relation fields in a record by fetching related data.
    K4: API enhancements - bounded include/expand
    """
    if not include_fields:
        return record
    
    schema_name = get_project_schema_name(project.id)
    is_sqlite = _is_sqlite(db)
    
    relation_fields = {f.name: f for f in get_relation_fields(db, collection.id)}
    
    expanded = dict(record)
    
    for field_name in include_fields:
        if field_name not in relation_fields:
            continue
        
        field = relation_fields[field_name]
        fk_column = field.sql_column_name
        fk_value = record.get(fk_column)
        
        if fk_value is None:
            expanded[field_name] = None
            continue
        
        target_collection = db.query(Collection).filter(
            Collection.id == field.relation_target_collection_id
        ).first()
        
        if not target_collection:
            expanded[field_name] = None
            continue
        
        if is_sqlite:
            target_table = f'"coll_{target_collection.sql_table_name}"'
        else:
            target_table = f'"{schema_name}"."{target_collection.sql_table_name}"'
        
        query = text(f'SELECT * FROM {target_table} WHERE id = :id LIMIT 1')
        result = db.execute(query, {"id": fk_value}).mappings().first()
        
        if result:
            expanded[field_name] = dict(result)
        else:
            expanded[field_name] = None
    
    return expanded


def validate_relation_value(
    db: Session,
    project: Project,
    field: Field,
    value: Any,
) -> bool:
    """Validate that a relation value (foreign key) exists in the target collection."""
    if value is None:
        return not field.is_required
    
    target_collection = db.query(Collection).filter(
        Collection.id == field.relation_target_collection_id
    ).first()
    
    if not target_collection:
        return False
    
    schema_name = get_project_schema_name(project.id)
    is_sqlite = _is_sqlite(db)
    
    if is_sqlite:
        target_table = f'"coll_{target_collection.sql_table_name}"'
    else:
        target_table = f'"{schema_name}"."{target_collection.sql_table_name}"'
    
    query = text(f'SELECT 1 FROM {target_table} WHERE id = :id LIMIT 1')
    result = db.execute(query, {"id": value}).first()
    
    return result is not None


def get_relation_info(field: Field) -> dict[str, Any] | None:
    """Get relation metadata for a field."""
    if field.field_type != "relation":
        return None
    
    return {
        "target_collection_id": field.relation_target_collection_id,
        "relation_type": field.relation_type,
        "on_delete": field.relation_on_delete,
        "display_field": field.relation_display_field,
    }
