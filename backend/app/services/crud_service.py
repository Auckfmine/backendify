from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.collection import Collection
from app.models.field import Field
from app.services.schema_manager import _is_sqlite, get_project_schema_name


def _get_table_ref(db: Session, project_id: str, table_name: str) -> str:
    if _is_sqlite(db):
        return f'"coll_{table_name}"'
    schema_name = get_project_schema_name(project_id)
    return f'"{schema_name}"."{table_name}"'


def _build_field_map(db: Session, collection: Collection) -> dict[str, Field]:
    """Build a map of field name/column name -> Field for lookups.
    
    Allows lookup by either field.name or field.sql_column_name.
    """
    fields = db.query(Field).filter(Field.collection_id == collection.id).all()
    field_map = {}
    for f in fields:
        field_map[f.name] = f
        # Also allow lookup by sql_column_name for convenience
        if f.sql_column_name and f.sql_column_name != f.name:
            field_map[f.sql_column_name] = f
    return field_map


def insert_record(
    db: Session,
    project_id: str,
    collection: Collection,
    data: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_app_user_id: str | None = None,
) -> dict[str, Any]:
    table_ref = _get_table_ref(db, project_id, collection.sql_table_name)
    field_map = _build_field_map(db, collection)
    
    columns = ["created_by_user_id", "created_by_app_user_id"]
    placeholders = [":created_by_user_id", ":created_by_app_user_id"]
    params = {
        "created_by_user_id": created_by_user_id,
        "created_by_app_user_id": created_by_app_user_id,
    }
    
    for key, value in data.items():
        if key in ("id", "created_at", "updated_at", "created_by_user_id", "created_by_app_user_id"):
            continue
        if key not in field_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown field: {key}",
            )
        field = field_map[key]
        columns.append(f'"{field.sql_column_name}"')
        placeholders.append(f":{key}")
        params[key] = value
    
    columns_str = ", ".join(columns)
    placeholders_str = ", ".join(placeholders)
    
    if _is_sqlite(db):
        insert_sql = text(f"""
            INSERT INTO {table_ref} ({columns_str})
            VALUES ({placeholders_str})
        """)
        db.execute(insert_sql, params)
        result = db.execute(text("SELECT last_insert_rowid()")).fetchone()
        record_id = result[0]
    else:
        insert_sql = text(f"""
            INSERT INTO {table_ref} ({columns_str})
            VALUES ({placeholders_str})
            RETURNING id
        """)
        result = db.execute(insert_sql, params)
        record_id = result.fetchone()[0]
    
    db.commit()
    return get_record_by_id(db, project_id, collection, record_id)


def get_record_by_id(
    db: Session,
    project_id: str,
    collection: Collection,
    record_id: int,
) -> dict[str, Any]:
    table_ref = _get_table_ref(db, project_id, collection.sql_table_name)
    
    select_sql = text(f"SELECT * FROM {table_ref} WHERE id = :id")
    result = db.execute(select_sql, {"id": record_id}).fetchone()
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )
    
    return dict(result._mapping)


# Supported filter operators
FILTER_OPERATORS = {
    "eq": "=",
    "neq": "!=",
    "gt": ">",
    "gte": ">=",
    "lt": "<",
    "lte": "<=",
    "like": "LIKE",
    "ilike": "ILIKE",  # Case-insensitive LIKE (Postgres)
    "contains": "LIKE",  # Will wrap value with %
    "startswith": "LIKE",  # Will append %
    "endswith": "LIKE",  # Will prepend %
    "in": "IN",
    "notin": "NOT IN",
    "isnull": "IS NULL",
    "isnotnull": "IS NOT NULL",
}


def _parse_filter_key(key: str) -> tuple[str, str]:
    """Parse filter key into (field_name, operator).
    
    Supports formats:
    - field_name -> (field_name, "eq")
    - field_name__operator -> (field_name, operator)
    """
    if "__" in key:
        parts = key.rsplit("__", 1)
        if len(parts) == 2 and parts[1] in FILTER_OPERATORS:
            return parts[0], parts[1]
    return key, "eq"


def _build_filter_condition(
    field: str, operator: str, value: Any, param_idx: int
) -> tuple[str, dict[str, Any]]:
    """Build SQL condition and params for a filter.
    
    Returns (condition_sql, params_dict).
    """
    param_name = f"filter_{param_idx}"
    sql_op = FILTER_OPERATORS.get(operator, "=")
    
    if operator == "isnull":
        if value in (True, "true", "1", "yes"):
            return f'"{field}" IS NULL', {}
        else:
            return f'"{field}" IS NOT NULL', {}
    
    if operator == "isnotnull":
        if value in (True, "true", "1", "yes"):
            return f'"{field}" IS NOT NULL', {}
        else:
            return f'"{field}" IS NULL', {}
    
    if operator == "in" or operator == "notin":
        # Value should be comma-separated list
        if isinstance(value, str):
            values = [v.strip() for v in value.split(",")]
        else:
            values = list(value)
        placeholders = ", ".join([f":{param_name}_{i}" for i in range(len(values))])
        params = {f"{param_name}_{i}": v for i, v in enumerate(values)}
        return f'"{field}" {sql_op} ({placeholders})', params
    
    if operator == "contains":
        return f'"{field}" LIKE :{param_name}', {param_name: f"%{value}%"}
    
    if operator == "startswith":
        return f'"{field}" LIKE :{param_name}', {param_name: f"{value}%"}
    
    if operator == "endswith":
        return f'"{field}" LIKE :{param_name}', {param_name: f"%{value}"}
    
    if operator == "ilike":
        # For SQLite compatibility, use LOWER()
        return f'LOWER("{field}") LIKE LOWER(:{param_name})', {param_name: f"%{value}%"}
    
    return f'"{field}" {sql_op} :{param_name}', {param_name: value}


def list_records(
    db: Session,
    project_id: str,
    collection: Collection,
    limit: int = 100,
    offset: int = 0,
    filters: dict[str, Any] | None = None,
    sort: str | None = None,
) -> list[dict[str, Any]]:
    """List records with advanced filtering and sorting.
    
    Args:
        filters: Dict of field__operator -> value. Operators: eq, neq, gt, gte, lt, lte,
                 like, ilike, contains, startswith, endswith, in, notin, isnull, isnotnull.
        sort: Comma-separated list of fields. Prefix with - for descending.
              Example: "-created_at,name" -> ORDER BY created_at DESC, name ASC
    """
    table_ref = _get_table_ref(db, project_id, collection.sql_table_name)
    
    where_clause = ""
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    
    if filters:
        conditions = []
        for idx, (key, value) in enumerate(filters.items()):
            field_name, operator = _parse_filter_key(key)
            condition, filter_params = _build_filter_condition(field_name, operator, value, idx)
            conditions.append(condition)
            params.update(filter_params)
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
    
    # Build ORDER BY clause
    order_clause = "ORDER BY id DESC"  # Default
    if sort:
        order_parts = []
        for field in sort.split(","):
            field = field.strip()
            if not field:
                continue
            if field.startswith("-"):
                order_parts.append(f'"{field[1:]}" DESC')
            else:
                order_parts.append(f'"{field}" ASC')
        if order_parts:
            order_clause = "ORDER BY " + ", ".join(order_parts)
    
    select_sql = text(f"SELECT * FROM {table_ref} {where_clause} {order_clause} LIMIT :limit OFFSET :offset")
    results = db.execute(select_sql, params).fetchall()
    
    return [dict(row._mapping) for row in results]


def update_record(
    db: Session,
    project_id: str,
    collection: Collection,
    record_id: int,
    data: dict[str, Any],
) -> dict[str, Any]:
    table_ref = _get_table_ref(db, project_id, collection.sql_table_name)
    field_map = _build_field_map(db, collection)
    
    existing = get_record_by_id(db, project_id, collection, record_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )
    
    set_clauses = []
    params = {"id": record_id}
    
    for key, value in data.items():
        if key in ("id", "created_at", "created_by_user_id"):
            continue
        if key not in field_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown field: {key}",
            )
        field = field_map[key]
        set_clauses.append(f'"{field.sql_column_name}" = :{key}')
        params[key] = value
    
    if _is_sqlite(db):
        set_clauses.append("updated_at = datetime('now')")
    else:
        set_clauses.append("updated_at = now()")
    
    if not set_clauses:
        return existing
    
    set_str = ", ".join(set_clauses)
    update_sql = text(f"UPDATE {table_ref} SET {set_str} WHERE id = :id")
    db.execute(update_sql, params)
    db.commit()
    
    return get_record_by_id(db, project_id, collection, record_id)


def delete_record(
    db: Session,
    project_id: str,
    collection: Collection,
    record_id: int,
) -> None:
    table_ref = _get_table_ref(db, project_id, collection.sql_table_name)
    
    existing = get_record_by_id(db, project_id, collection, record_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )
    
    delete_sql = text(f"DELETE FROM {table_ref} WHERE id = :id")
    db.execute(delete_sql, {"id": record_id})
    db.commit()


def count_records(
    db: Session,
    project_id: str,
    collection: Collection,
    filters: dict[str, Any] | None = None,
) -> int:
    """Count records with advanced filtering support."""
    table_ref = _get_table_ref(db, project_id, collection.sql_table_name)
    
    where_clause = ""
    params: dict[str, Any] = {}
    
    if filters:
        conditions = []
        for idx, (key, value) in enumerate(filters.items()):
            field_name, operator = _parse_filter_key(key)
            condition, filter_params = _build_filter_condition(field_name, operator, value, idx)
            conditions.append(condition)
            params.update(filter_params)
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
    
    count_sql = text(f"SELECT COUNT(*) FROM {table_ref} {where_clause}")
    result = db.execute(count_sql, params).fetchone()
    return result[0]
