"""
App User Service

Handles CRUD operations for app users stored in the _users collection table.
This replaces the AppUser SQLAlchemy model with direct SQL operations on the
project-scoped _users collection.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.collection import USERS_COLLECTION_NAME
from app.services.schema_manager import get_project_schema_name, _is_sqlite


@dataclass
class AppUserRecord:
    """Data class representing an app user record from _users collection."""
    id: str
    email: str
    password_hash: Optional[str]
    is_email_verified: bool
    is_disabled: bool
    created_at: datetime
    updated_at: datetime
    project_id: str  # Not stored in table, but useful for context
    
    @property
    def is_active(self) -> bool:
        return not self.is_disabled


def _get_users_table_name(project_id: str, is_sqlite: bool) -> str:
    """Get the full table name for _users collection."""
    if is_sqlite:
        return f'"coll_{USERS_COLLECTION_NAME}"'
    schema_name = get_project_schema_name(project_id)
    return f'"{schema_name}"."{USERS_COLLECTION_NAME}"'


def _row_to_app_user(row, project_id: str) -> AppUserRecord:
    """Convert a database row to AppUserRecord."""
    return AppUserRecord(
        id=row.id,
        email=row.email,
        password_hash=row.password_hash,
        is_email_verified=bool(row.is_email_verified),
        is_disabled=bool(row.is_disabled),
        created_at=row.created_at,
        updated_at=row.updated_at,
        project_id=project_id,
    )


def get_app_user_by_id(
    db: Session,
    project_id: str,
    user_id: str,
) -> Optional[AppUserRecord]:
    """Get an app user by ID from the _users collection."""
    is_sqlite = _is_sqlite(db)
    table = _get_users_table_name(project_id, is_sqlite)
    
    sql = text(f"""
        SELECT id, email, password_hash, is_email_verified, is_disabled, created_at, updated_at
        FROM {table}
        WHERE id = :user_id
    """)
    
    result = db.execute(sql, {"user_id": user_id}).fetchone()
    if not result:
        return None
    
    return _row_to_app_user(result, project_id)


def get_app_user_by_email(
    db: Session,
    project_id: str,
    email: str,
) -> Optional[AppUserRecord]:
    """Get an app user by email from the _users collection."""
    is_sqlite = _is_sqlite(db)
    table = _get_users_table_name(project_id, is_sqlite)
    
    sql = text(f"""
        SELECT id, email, password_hash, is_email_verified, is_disabled, created_at, updated_at
        FROM {table}
        WHERE LOWER(email) = LOWER(:email)
    """)
    
    result = db.execute(sql, {"email": email}).fetchone()
    if not result:
        return None
    
    return _row_to_app_user(result, project_id)


def create_app_user(
    db: Session,
    project_id: str,
    email: str,
    password_hash: Optional[str] = None,
    is_email_verified: bool = False,
    is_disabled: bool = False,
) -> AppUserRecord:
    """Create a new app user in the _users collection."""
    is_sqlite = _is_sqlite(db)
    table = _get_users_table_name(project_id, is_sqlite)
    user_id = str(uuid4())
    
    if is_sqlite:
        sql = text(f"""
            INSERT INTO {table} (id, email, password_hash, is_email_verified, is_disabled, created_at, updated_at)
            VALUES (:id, :email, :password_hash, :is_email_verified, :is_disabled, datetime('now'), datetime('now'))
        """)
    else:
        sql = text(f"""
            INSERT INTO {table} (id, email, password_hash, is_email_verified, is_disabled, created_at, updated_at)
            VALUES (:id, :email, :password_hash, :is_email_verified, :is_disabled, NOW(), NOW())
        """)
    
    db.execute(sql, {
        "id": user_id,
        "email": email.lower(),
        "password_hash": password_hash,
        "is_email_verified": is_email_verified,
        "is_disabled": is_disabled,
    })
    db.commit()
    
    # Fetch and return the created user
    return get_app_user_by_id(db, project_id, user_id)


def update_app_user(
    db: Session,
    project_id: str,
    user_id: str,
    email: Optional[str] = None,
    password_hash: Optional[str] = None,
    is_email_verified: Optional[bool] = None,
    is_disabled: Optional[bool] = None,
) -> Optional[AppUserRecord]:
    """Update an app user in the _users collection."""
    is_sqlite = _is_sqlite(db)
    table = _get_users_table_name(project_id, is_sqlite)
    
    # Build dynamic update
    updates = []
    params = {"user_id": user_id}
    
    if email is not None:
        updates.append("email = :email")
        params["email"] = email.lower()
    if password_hash is not None:
        updates.append("password_hash = :password_hash")
        params["password_hash"] = password_hash
    if is_email_verified is not None:
        updates.append("is_email_verified = :is_email_verified")
        params["is_email_verified"] = is_email_verified
    if is_disabled is not None:
        updates.append("is_disabled = :is_disabled")
        params["is_disabled"] = is_disabled
    
    if not updates:
        return get_app_user_by_id(db, project_id, user_id)
    
    if is_sqlite:
        updates.append("updated_at = datetime('now')")
    else:
        updates.append("updated_at = NOW()")
    
    sql = text(f"""
        UPDATE {table}
        SET {', '.join(updates)}
        WHERE id = :user_id
    """)
    
    db.execute(sql, params)
    db.commit()
    
    return get_app_user_by_id(db, project_id, user_id)


def delete_app_user(
    db: Session,
    project_id: str,
    user_id: str,
) -> bool:
    """Delete an app user from the _users collection."""
    is_sqlite = _is_sqlite(db)
    table = _get_users_table_name(project_id, is_sqlite)
    
    sql = text(f"""
        DELETE FROM {table}
        WHERE id = :user_id
    """)
    
    result = db.execute(sql, {"user_id": user_id})
    db.commit()
    
    return result.rowcount > 0


def list_app_users(
    db: Session,
    project_id: str,
    limit: int = 100,
    offset: int = 0,
) -> List[AppUserRecord]:
    """List app users from the _users collection."""
    is_sqlite = _is_sqlite(db)
    table = _get_users_table_name(project_id, is_sqlite)
    
    sql = text(f"""
        SELECT id, email, password_hash, is_email_verified, is_disabled, created_at, updated_at
        FROM {table}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    
    results = db.execute(sql, {"limit": limit, "offset": offset}).fetchall()
    return [_row_to_app_user(row, project_id) for row in results]


def count_app_users(
    db: Session,
    project_id: str,
) -> int:
    """Count app users in the _users collection."""
    is_sqlite = _is_sqlite(db)
    table = _get_users_table_name(project_id, is_sqlite)
    
    sql = text(f"SELECT COUNT(*) as cnt FROM {table}")
    result = db.execute(sql).fetchone()
    return result.cnt if result else 0


def app_user_exists(
    db: Session,
    project_id: str,
    email: str,
) -> bool:
    """Check if an app user with the given email exists."""
    return get_app_user_by_email(db, project_id, email) is not None
