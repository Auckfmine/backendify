"""
Service for managing the special _users collection.

The _users collection is a system collection that:
- Is auto-created when a project is created
- Has protected system fields (email, password_hash, etc.)
- Allows custom fields to be added
- Can be referenced in relations from other collections
- Hides sensitive fields (password_hash) in API responses
"""
from sqlalchemy.orm import Session

from app.models.collection import Collection, USERS_COLLECTION_NAME
from app.models.field import Field
from app.models.project import Project
from app.services.schema_manager import (
    ensure_project_schema,
    create_collection_table,
    add_column_to_table,
    get_project_schema_name,
    _is_sqlite,
)
from sqlalchemy import text


# System fields for the _users collection
# These fields mirror the app_users table but are managed as a collection
USERS_SYSTEM_FIELDS = [
    {
        "name": "email",
        "display_name": "Email",
        "field_type": "string",
        "is_required": True,
        "is_unique": True,
        "is_indexed": True,
        "is_system": True,
        "is_hidden": False,
    },
    {
        "name": "password_hash",
        "display_name": "Password Hash",
        "field_type": "string",
        "is_required": False,
        "is_unique": False,
        "is_indexed": False,
        "is_system": True,
        "is_hidden": True,  # Never expose in API
    },
    {
        "name": "is_email_verified",
        "display_name": "Email Verified",
        "field_type": "bool",
        "is_required": False,
        "is_unique": False,
        "is_indexed": False,
        "is_system": True,
        "is_hidden": False,
        "default_value": "false",
    },
    {
        "name": "is_disabled",
        "display_name": "Disabled",
        "field_type": "bool",
        "is_required": False,
        "is_unique": False,
        "is_indexed": False,
        "is_system": True,
        "is_hidden": False,
        "default_value": "false",
    },
]

# Fields that should never be exposed in API responses
HIDDEN_FIELD_NAMES = {"password_hash"}

# Fields that cannot be modified by the user
PROTECTED_FIELD_NAMES = {"email", "password_hash", "is_email_verified", "is_disabled"}


def create_users_collection(
    db: Session,
    project: Project,
    actor_user_id: str | None = None,
) -> Collection:
    """
    Create the _users collection for a project with system fields.
    This should be called when a project is created.
    """
    # Check if already exists
    existing = db.query(Collection).filter(
        Collection.project_id == project.id,
        Collection.name == USERS_COLLECTION_NAME,
    ).first()
    if existing:
        return existing
    
    # Ensure project schema exists
    ensure_project_schema(db, project, actor_user_id=actor_user_id)
    
    # Create the collection record
    collection = Collection(
        project_id=project.id,
        name=USERS_COLLECTION_NAME,
        display_name="Users",
        sql_table_name=USERS_COLLECTION_NAME,
        is_active=True,
        is_system=True,
    )
    db.add(collection)
    db.flush()
    
    # Create the table with system columns
    _create_users_table(db, project, collection, actor_user_id)
    
    # Create field records for system fields
    for field_def in USERS_SYSTEM_FIELDS:
        field = Field(
            collection_id=collection.id,
            name=field_def["name"],
            display_name=field_def["display_name"],
            field_type=field_def["field_type"],
            sql_column_name=field_def["name"],
            is_required=field_def.get("is_required", False),
            is_unique=field_def.get("is_unique", False),
            is_indexed=field_def.get("is_indexed", False),
            default_value=field_def.get("default_value"),
            is_system=field_def.get("is_system", False),
            is_hidden=field_def.get("is_hidden", False),
        )
        db.add(field)
    
    db.commit()
    db.refresh(collection)
    return collection


def _create_users_table(
    db: Session,
    project: Project,
    collection: Collection,
    actor_user_id: str | None = None,
) -> None:
    """
    Create the _users table with all system columns.
    This is different from regular collection tables because it includes
    auth-specific columns.
    """
    schema_name = get_project_schema_name(project.id)
    table_name = collection.sql_table_name
    
    if _is_sqlite(db):
        prefixed_table = f"coll_{table_name}"
        create_sql = text(f"""
            CREATE TABLE "{prefixed_table}" (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NULL,
                is_email_verified INTEGER NOT NULL DEFAULT 0,
                is_disabled INTEGER NOT NULL DEFAULT 0,
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
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NULL,
                is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
                is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                created_by_user_id TEXT NULL,
                created_by_app_user_id TEXT NULL
            )
        """)
    
    db.execute(create_sql)
    
    # Create index on email
    if _is_sqlite(db):
        idx_sql = text(f'CREATE INDEX "ix_{table_name}_email" ON "coll_{table_name}" ("email")')
    else:
        idx_sql = text(f'CREATE INDEX "ix_{table_name}_email" ON {full_table} ("email")')
    db.execute(idx_sql)


def get_users_collection(db: Session, project: Project) -> Collection | None:
    """Get the _users collection for a project."""
    return db.query(Collection).filter(
        Collection.project_id == project.id,
        Collection.name == USERS_COLLECTION_NAME,
    ).first()


def get_visible_fields(db: Session, collection: Collection) -> list[Field]:
    """Get all non-hidden fields for a collection."""
    return db.query(Field).filter(
        Field.collection_id == collection.id,
        Field.is_deleted == False,
        Field.is_hidden == False,
    ).all()


def is_field_protected(field: Field) -> bool:
    """Check if a field is protected (cannot be deleted or have type changed)."""
    return field.is_system


def is_field_hidden(field: Field) -> bool:
    """Check if a field should be hidden from API responses."""
    return field.is_hidden
