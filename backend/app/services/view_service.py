"""
View Service - Milestone L
Handles creation and execution of saved queries (views).
"""
import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.collection import Collection
from app.models.field import Field
from app.models.view import View, ViewVersion
from app.models.project import Project
from app.services.schema_manager import _is_sqlite, get_project_schema_name, validate_slug
from app.services.policy_service import check_permission

VALID_OPERATORS = ["=", "!=", ">", "<", ">=", "<=", "in", "not_in", "contains", "starts_with", "ends_with", "is_null", "is_not_null"]
MAX_JOINS = 1
MAX_FILTERS = 20
MAX_ROWS = 1000


def create_view(
    db: Session,
    project: Project,
    name: str,
    display_name: str,
    base_collection_id: str,
    description: str | None = None,
    projection: list[str] | None = None,
    filters: list[dict] | None = None,
    sorts: list[dict] | None = None,
    joins: list[dict] | None = None,
    params_schema: dict | None = None,
    default_limit: int = 100,
    max_limit: int = 1000,
    actor_user_id: str | None = None,
) -> View:
    """Create a new view (saved query)."""
    if not validate_slug(name):
        raise ValueError(f"Invalid view name: {name}")
    
    existing = db.query(View).filter(
        View.project_id == project.id,
        View.name == name,
        View.is_active == True,
    ).first()
    if existing:
        raise ValueError(f"View with name '{name}' already exists")
    
    base_collection = db.query(Collection).filter(
        Collection.id == base_collection_id,
        Collection.project_id == project.id,
    ).first()
    if not base_collection:
        raise ValueError("Base collection not found")
    
    if filters and len(filters) > MAX_FILTERS:
        raise ValueError(f"Too many filters. Maximum is {MAX_FILTERS}")
    
    if joins and len(joins) > MAX_JOINS:
        raise ValueError(f"Too many joins. Maximum is {MAX_JOINS} in v1")
    
    if filters:
        _validate_filters(filters)
    
    view = View(
        project_id=project.id,
        name=name,
        display_name=display_name,
        description=description,
        base_collection_id=base_collection_id,
        projection_json=json.dumps(projection) if projection else None,
        filters_json=json.dumps(filters) if filters else None,
        sorts_json=json.dumps(sorts) if sorts else None,
        joins_json=json.dumps(joins) if joins else None,
        params_schema_json=json.dumps(params_schema) if params_schema else None,
        default_limit=min(default_limit, MAX_ROWS),
        max_limit=min(max_limit, MAX_ROWS),
        version=1,
    )
    db.add(view)
    db.flush()
    
    version = ViewVersion(
        view_id=view.id,
        version=1,
        projection_json=view.projection_json,
        filters_json=view.filters_json,
        sorts_json=view.sorts_json,
        joins_json=view.joins_json,
        params_schema_json=view.params_schema_json,
        created_by_user_id=actor_user_id,
    )
    db.add(version)
    db.commit()
    db.refresh(view)
    
    return view


def _validate_filters(filters: list[dict]) -> None:
    """Validate filter definitions."""
    for f in filters:
        if "field" not in f:
            raise ValueError("Filter missing 'field'")
        if "operator" not in f:
            raise ValueError("Filter missing 'operator'")
        if f["operator"] not in VALID_OPERATORS:
            raise ValueError(f"Invalid operator: {f['operator']}")
        if f["operator"] not in ["is_null", "is_not_null"] and "value" not in f:
            raise ValueError(f"Filter with operator '{f['operator']}' requires 'value'")


def update_view(
    db: Session,
    view: View,
    projection: list[str] | None = None,
    filters: list[dict] | None = None,
    sorts: list[dict] | None = None,
    joins: list[dict] | None = None,
    params_schema: dict | None = None,
    display_name: str | None = None,
    description: str | None = None,
    actor_user_id: str | None = None,
) -> View:
    """Update a view and create a new version."""
    if filters and len(filters) > MAX_FILTERS:
        raise ValueError(f"Too many filters. Maximum is {MAX_FILTERS}")
    
    if joins and len(joins) > MAX_JOINS:
        raise ValueError(f"Too many joins. Maximum is {MAX_JOINS} in v1")
    
    if filters:
        _validate_filters(filters)
    
    view.version += 1
    if projection is not None:
        view.projection_json = json.dumps(projection) if projection else None
    if filters is not None:
        view.filters_json = json.dumps(filters) if filters else None
    if sorts is not None:
        view.sorts_json = json.dumps(sorts) if sorts else None
    if joins is not None:
        view.joins_json = json.dumps(joins) if joins else None
    if params_schema is not None:
        view.params_schema_json = json.dumps(params_schema) if params_schema else None
    if display_name:
        view.display_name = display_name
    if description is not None:
        view.description = description
    
    version = ViewVersion(
        view_id=view.id,
        version=view.version,
        projection_json=view.projection_json,
        filters_json=view.filters_json,
        sorts_json=view.sorts_json,
        joins_json=view.joins_json,
        params_schema_json=view.params_schema_json,
        created_by_user_id=actor_user_id,
    )
    db.add(version)
    db.commit()
    db.refresh(view)
    
    return view


def get_view(db: Session, project_id: str, view_name: str) -> View | None:
    """Get a view by name."""
    return db.query(View).filter(
        View.project_id == project_id,
        View.name == view_name,
        View.is_active == True,
    ).first()


def get_view_by_id(db: Session, project_id: str, view_id: str) -> View | None:
    """Get a view by ID."""
    return db.query(View).filter(
        View.project_id == project_id,
        View.id == view_id,
        View.is_active == True,
    ).first()


def list_views(db: Session, project_id: str) -> list[View]:
    """List all views for a project."""
    return db.query(View).filter(
        View.project_id == project_id,
        View.is_active == True,
    ).order_by(View.name).all()


def delete_view(db: Session, view: View) -> None:
    """Soft delete a view."""
    view.is_active = False
    db.commit()


def get_view_versions(db: Session, view_id: str) -> list[ViewVersion]:
    """Get all versions of a view."""
    return db.query(ViewVersion).filter(
        ViewVersion.view_id == view_id,
    ).order_by(ViewVersion.version.desc()).all()


def execute_view(
    db: Session,
    project: Project,
    view: View,
    params: dict[str, Any] | None = None,
    limit: int | None = None,
    offset: int = 0,
    current_user_id: str | None = None,
) -> dict[str, Any]:
    """
    Execute a view and return results.
    L3: Runtime execution engine
    """
    base_collection = db.query(Collection).filter(
        Collection.id == view.base_collection_id
    ).first()
    
    if not base_collection:
        raise ValueError("Base collection not found")
    
    schema_name = get_project_schema_name(project.id)
    is_sqlite = _is_sqlite(db)
    
    if is_sqlite:
        table_name = f'"coll_{base_collection.sql_table_name}"'
    else:
        table_name = f'"{schema_name}"."{base_collection.sql_table_name}"'
    
    projection = json.loads(view.projection_json) if view.projection_json else ["*"]
    filters = json.loads(view.filters_json) if view.filters_json else []
    sorts = json.loads(view.sorts_json) if view.sorts_json else []
    params_schema = json.loads(view.params_schema_json) if view.params_schema_json else {}
    
    if projection == ["*"]:
        select_clause = "*"
    else:
        select_clause = ", ".join([f'"{col}"' for col in projection])
    
    where_clauses = []
    bind_params = {}
    
    for i, f in enumerate(filters):
        field = f["field"]
        operator = f["operator"]
        param_name = f"p{i}"
        
        if f.get("is_param") and params:
            value = params.get(f.get("param_name", field))
        else:
            value = f.get("value")
        
        clause = _build_filter_clause(field, operator, value, param_name, bind_params)
        if clause:
            where_clauses.append(clause)
    
    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    
    # Build order clause - supports parameterized sort field and direction
    order_clauses = []
    for s in sorts:
        # Check if sort field is parameterized
        if s.get("is_param") and params:
            sort_field = params.get(s.get("param_name", "sort_field"), s.get("field", "id"))
        else:
            sort_field = s.get("field", "id")
        
        # Check if sort direction is parameterized
        if s.get("desc_is_param") and params:
            desc_param = params.get(s.get("desc_param_name", "sort_desc"), False)
            direction = "DESC" if desc_param in (True, "true", "desc", "DESC", 1, "1") else "ASC"
        else:
            direction = "DESC" if s.get("desc", False) else "ASC"
        
        # Validate sort field is in projection or is a system field
        valid_fields = projection if projection != ["*"] else []
        system_fields = ["id", "created_at", "updated_at"]
        if sort_field and (projection == ["*"] or sort_field in valid_fields or sort_field in system_fields):
            order_clauses.append(f'"{sort_field}" {direction}')
    
    order_sql = ", ".join(order_clauses) if order_clauses else "id ASC"
    
    # Check for parameterized limit/offset
    param_limit = None
    param_offset = None
    for param_name, param_def in params_schema.items():
        if param_def.get("type") == "limit" and params:
            param_limit = params.get(param_name)
        elif param_def.get("type") == "offset" and params:
            param_offset = params.get(param_name)
    
    # Use parameterized values if provided, otherwise fall back to request values
    final_limit = param_limit if param_limit is not None else limit
    final_offset = param_offset if param_offset is not None else offset
    
    effective_limit = min(final_limit or view.default_limit, view.max_limit, MAX_ROWS)
    
    count_sql = text(f'SELECT COUNT(*) FROM {table_name} WHERE {where_sql}')
    total = db.execute(count_sql, bind_params).scalar()
    
    query_sql = text(
        f'SELECT {select_clause} FROM {table_name} WHERE {where_sql} '
        f'ORDER BY {order_sql} LIMIT :limit OFFSET :offset'
    )
    bind_params["limit"] = effective_limit
    bind_params["offset"] = final_offset
    
    results = db.execute(query_sql, bind_params).mappings().all()
    
    return {
        "data": [dict(r) for r in results],
        "total": total,
        "limit": effective_limit,
        "offset": final_offset,
        "view_name": view.name,
        "view_version": view.version,
    }


def _build_filter_clause(field: str, operator: str, value: Any, param_name: str, bind_params: dict) -> str | None:
    """Build a SQL WHERE clause for a filter."""
    quoted_field = f'"{field}"'
    
    if operator == "=":
        bind_params[param_name] = value
        return f'{quoted_field} = :{param_name}'
    elif operator == "!=":
        bind_params[param_name] = value
        return f'{quoted_field} != :{param_name}'
    elif operator == ">":
        bind_params[param_name] = value
        return f'{quoted_field} > :{param_name}'
    elif operator == "<":
        bind_params[param_name] = value
        return f'{quoted_field} < :{param_name}'
    elif operator == ">=":
        bind_params[param_name] = value
        return f'{quoted_field} >= :{param_name}'
    elif operator == "<=":
        bind_params[param_name] = value
        return f'{quoted_field} <= :{param_name}'
    elif operator == "in":
        if not isinstance(value, list):
            value = [value]
        placeholders = ", ".join([f":{param_name}_{i}" for i in range(len(value))])
        for i, v in enumerate(value):
            bind_params[f"{param_name}_{i}"] = v
        return f'{quoted_field} IN ({placeholders})'
    elif operator == "not_in":
        if not isinstance(value, list):
            value = [value]
        placeholders = ", ".join([f":{param_name}_{i}" for i in range(len(value))])
        for i, v in enumerate(value):
            bind_params[f"{param_name}_{i}"] = v
        return f'{quoted_field} NOT IN ({placeholders})'
    elif operator == "contains":
        bind_params[param_name] = f"%{value}%"
        return f'{quoted_field} LIKE :{param_name}'
    elif operator == "starts_with":
        bind_params[param_name] = f"{value}%"
        return f'{quoted_field} LIKE :{param_name}'
    elif operator == "ends_with":
        bind_params[param_name] = f"%{value}"
        return f'{quoted_field} LIKE :{param_name}'
    elif operator == "is_null":
        return f'{quoted_field} IS NULL'
    elif operator == "is_not_null":
        return f'{quoted_field} IS NOT NULL'
    
    return None


def get_available_operators() -> list[dict]:
    """Get list of available filter operators."""
    return [
        {"value": "=", "label": "Equals", "types": ["all"]},
        {"value": "!=", "label": "Not Equals", "types": ["all"]},
        {"value": ">", "label": "Greater Than", "types": ["int", "float", "date", "datetime"]},
        {"value": "<", "label": "Less Than", "types": ["int", "float", "date", "datetime"]},
        {"value": ">=", "label": "Greater or Equal", "types": ["int", "float", "date", "datetime"]},
        {"value": "<=", "label": "Less or Equal", "types": ["int", "float", "date", "datetime"]},
        {"value": "in", "label": "In List", "types": ["all"]},
        {"value": "not_in", "label": "Not In List", "types": ["all"]},
        {"value": "contains", "label": "Contains", "types": ["string"]},
        {"value": "starts_with", "label": "Starts With", "types": ["string"]},
        {"value": "ends_with", "label": "Ends With", "types": ["string"]},
        {"value": "is_null", "label": "Is Null", "types": ["all"]},
        {"value": "is_not_null", "label": "Is Not Null", "types": ["all"]},
    ]


def get_view_meta(db: Session, project: Project, view: View) -> dict[str, Any]:
    """
    Get view metadata for API documentation (L5.2).
    Returns endpoint info, params, filters, sorts, and example requests.
    """
    base_collection = db.query(Collection).filter(
        Collection.id == view.base_collection_id
    ).first()
    
    fields = db.query(Field).filter(
        Field.collection_id == view.base_collection_id,
        Field.is_deleted == False,
    ).all()
    
    projection = json.loads(view.projection_json) if view.projection_json else None
    filters = json.loads(view.filters_json) if view.filters_json else []
    sorts = json.loads(view.sorts_json) if view.sorts_json else []
    params_schema = json.loads(view.params_schema_json) if view.params_schema_json else {}
    
    base_url = f"/api/projects/{project.id}/views/{view.name}"
    
    param_fields = []
    for param_name, param_def in params_schema.items():
        param_fields.append({
            "name": param_name,
            "type": param_def.get("type", "string"),
            "required": param_def.get("required", False),
            "description": param_def.get("description", ""),
            "example": param_def.get("example", ""),
        })
    
    response_fields = []
    if projection:
        for col in projection:
            field = next((f for f in fields if f.sql_column_name == col), None)
            if field:
                response_fields.append({
                    "name": col,
                    "type": field.field_type,
                    "display_name": field.display_name,
                })
            elif col in ["id", "created_at", "updated_at", "created_by_user_id"]:
                response_fields.append({
                    "name": col,
                    "type": "system",
                    "display_name": col.replace("_", " ").title(),
                })
    else:
        response_fields.append({"name": "id", "type": "int", "display_name": "ID"})
        response_fields.append({"name": "created_at", "type": "datetime", "display_name": "Created At"})
        response_fields.append({"name": "updated_at", "type": "datetime", "display_name": "Updated At"})
        for field in fields:
            response_fields.append({
                "name": field.sql_column_name,
                "type": field.field_type,
                "display_name": field.display_name,
            })
    
    filter_fields = [f.sql_column_name for f in fields] + ["id", "created_at", "updated_at"]
    sort_fields = filter_fields.copy()
    
    default_sort = sorts[0] if sorts else {"field": "id", "desc": False}
    
    params_example = "&".join([f"{p['name']}={p['example'] or 'value'}" for p in param_fields]) if param_fields else ""
    execute_url = f"{base_url}/execute"
    
    curl_example = f'''curl -X POST "{execute_url}" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{{"limit": {view.default_limit}, "offset": 0{', "params": {' + json.dumps({p["name"]: p["example"] or "value" for p in param_fields}) + '}' if param_fields else ''}}}'
'''
    
    params_js = ""
    if param_fields:
        params_obj = {p["name"]: p["example"] or "value" for p in param_fields}
        params_js = f"\n    params: {json.dumps(params_obj)},"
    
    fetch_example = f'''const response = await fetch("{execute_url}", {{
  method: "POST",
  headers: {{
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json",
  }},
  body: JSON.stringify({{
    limit: {view.default_limit},
    offset: 0,{params_js}
  }}),
}});
const data = await response.json();
'''
    
    return {
        "view_name": view.name,
        "display_name": view.display_name,
        "description": view.description,
        "base_collection": base_collection.name if base_collection else None,
        "endpoint": {
            "url": execute_url,
            "method": "POST",
            "auth": ["Bearer Token (JWT)", "API Key (X-API-Key header)"],
        },
        "request": {
            "body": {
                "limit": {"type": "int", "default": view.default_limit, "max": view.max_limit, "description": "Number of records to return"},
                "offset": {"type": "int", "default": 0, "description": "Number of records to skip"},
                "params": {"type": "object", "description": "View parameters", "fields": param_fields} if param_fields else None,
            },
        },
        "response": {
            "fields": response_fields,
            "pagination": {
                "type": "offset",
                "default_limit": view.default_limit,
                "max_limit": view.max_limit,
            },
        },
        "filters": {
            "allowed_fields": filter_fields,
            "operators": [op["value"] for op in get_available_operators()],
            "predefined": filters,
        },
        "sorts": {
            "allowed_fields": sort_fields,
            "default": default_sort,
            "predefined": sorts,
        },
        "examples": {
            "curl": curl_example,
            "fetch": fetch_example,
        },
    }
