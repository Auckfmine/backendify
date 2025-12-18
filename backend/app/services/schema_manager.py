import json
import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.collection import Collection
from app.models.field import Field
from app.models.project import Project
from app.models.schema_op import SchemaOp

SLUG_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
RESERVED_WORDS = frozenset([
    "select", "insert", "update", "delete", "drop", "create", "alter", "table",
    "index", "from", "where", "and", "or", "not", "null", "true", "false",
    "primary", "foreign", "key", "references", "constraint", "unique", "check",
    "default", "on", "cascade", "set", "grant", "revoke", "user", "role",
    "schema", "database", "public", "information_schema", "pg_catalog",
])

FIELD_TYPE_MAP = {
    "string": "text",
    "int": "bigint",
    "float": "double precision",
    "bool": "boolean",
    "date": "date",
    "datetime": "timestamptz",
    "uuid": "uuid",
}

FIELD_TYPE_MAP_SQLITE = {
    "string": "TEXT",
    "int": "INTEGER",
    "float": "REAL",
    "bool": "INTEGER",
    "date": "TEXT",
    "datetime": "TEXT",
    "uuid": "TEXT",
}


def _is_sqlite(db: Session) -> bool:
    return "sqlite" in db.bind.dialect.name


def get_project_schema_name(project_id: str) -> str:
    safe_id = project_id.replace("-", "_")
    return f"p_{safe_id}"


def validate_slug(name: str) -> bool:
    if not SLUG_PATTERN.match(name):
        return False
    if name in RESERVED_WORDS:
        return False
    return True


def ensure_project_schema(db: Session, project: Project, actor_user_id: str | None = None) -> str:
    schema_name = get_project_schema_name(project.id)
    
    if _is_sqlite(db):
        op = SchemaOp(
            project_id=project.id,
            collection_id=None,
            op_type="create_schema",
            payload_json=json.dumps({"schema_name": schema_name}),
            status="applied",
            actor_user_id=actor_user_id,
        )
        db.add(op)
        db.commit()
        return schema_name
    
    check_sql = text(
        "SELECT 1 FROM information_schema.schemata WHERE schema_name = :schema_name"
    )
    result = db.execute(check_sql, {"schema_name": schema_name}).fetchone()
    
    if result is None:
        create_sql = text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')
        db.execute(create_sql)
        
        op = SchemaOp(
            project_id=project.id,
            collection_id=None,
            op_type="create_schema",
            payload_json=json.dumps({"schema_name": schema_name}),
            status="applied",
            actor_user_id=actor_user_id,
        )
        db.add(op)
        db.commit()
    
    return schema_name


def create_collection_table(
    db: Session,
    project: Project,
    collection: Collection,
    actor_user_id: str | None = None,
) -> None:
    schema_name = get_project_schema_name(project.id)
    table_name = collection.sql_table_name
    
    if _is_sqlite(db):
        prefixed_table = f"coll_{table_name}"
        create_sql = text(f"""
            CREATE TABLE "{prefixed_table}" (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                created_by_user_id TEXT NULL,
                created_by_app_user_id TEXT NULL
            )
        """)
    else:
        full_table = f'"{schema_name}"."{table_name}"'
        create_sql = text(f"""
            CREATE TABLE {full_table} (
                id BIGSERIAL PRIMARY KEY,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                created_by_user_id text NULL,
                created_by_app_user_id text NULL
            )
        """)
    
    db.execute(create_sql)
    
    op = SchemaOp(
        project_id=project.id,
        collection_id=collection.id,
        op_type="create_table",
        payload_json=json.dumps({
            "schema_name": schema_name,
            "table_name": table_name,
            "collection_name": collection.name,
        }),
        status="applied",
        actor_user_id=actor_user_id,
    )
    db.add(op)


def add_column_to_table(
    db: Session,
    project: Project,
    collection: Collection,
    field: Field,
    actor_user_id: str | None = None,
) -> None:
    schema_name = get_project_schema_name(project.id)
    table_name = collection.sql_table_name
    column_name = field.sql_column_name
    
    is_sqlite = _is_sqlite(db)
    sql_type = FIELD_TYPE_MAP_SQLITE.get(field.field_type, "TEXT") if is_sqlite else FIELD_TYPE_MAP.get(field.field_type, "text")
    
    if is_sqlite:
        target_table = f'"coll_{table_name}"'
    else:
        target_table = f'"{schema_name}"."{table_name}"'
    
    nullable = "NULL" if not field.is_required else "NOT NULL"
    default_clause = ""
    
    if field.is_required and field.default_value is not None:
        if field.field_type == "string":
            default_clause = f"DEFAULT '{field.default_value}'"
        elif field.field_type == "bool":
            default_clause = f"DEFAULT {field.default_value.lower()}"
        else:
            default_clause = f"DEFAULT {field.default_value}"
    elif field.is_required and field.default_value is None:
        nullable = "NULL"
    
    alter_sql = text(
        f'ALTER TABLE {target_table} ADD COLUMN "{column_name}" {sql_type} {nullable} {default_clause}'
    )
    db.execute(alter_sql)
    
    if field.is_unique:
        idx_name = f"uq_{table_name}_{column_name}"
        unique_sql = text(
            f'CREATE UNIQUE INDEX "{idx_name}" ON {target_table} ("{column_name}")'
        )
        db.execute(unique_sql)
    elif field.is_indexed:
        idx_name = f"ix_{table_name}_{column_name}"
        index_sql = text(
            f'CREATE INDEX "{idx_name}" ON {target_table} ("{column_name}")'
        )
        db.execute(index_sql)
    
    op = SchemaOp(
        project_id=project.id,
        collection_id=collection.id,
        op_type="add_column",
        payload_json=json.dumps({
            "table_name": table_name,
            "column_name": column_name,
            "field_type": field.field_type,
            "is_required": field.is_required,
            "is_unique": field.is_unique,
            "is_indexed": field.is_indexed,
        }),
        status="applied",
        actor_user_id=actor_user_id,
    )
    db.add(op)


def get_full_table_name(project_id: str, sql_table_name: str) -> str:
    schema_name = get_project_schema_name(project_id)
    return f'"{schema_name}"."{sql_table_name}"'
