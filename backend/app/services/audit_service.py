import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent
from app.models.collection import Collection
from app.models.schema_op import SchemaOp


def _json_serializer(obj: Any) -> str:
    """Custom JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _safe_json_dumps(data: dict[str, Any] | None) -> str | None:
    """Safely serialize data to JSON, handling datetime objects."""
    if data is None:
        return None
    return json.dumps(data, default=_json_serializer)


def log_audit_event(
    db: Session,
    project_id: str,
    action: str,
    collection_id: str | None = None,
    record_id: str | None = None,
    actor_user_id: str | None = None,
    actor_api_key_id: str | None = None,
    actor_app_user_id: str | None = None,
    old_data: dict[str, Any] | None = None,
    new_data: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditEvent:
    event = AuditEvent(
        project_id=project_id,
        collection_id=collection_id,
        record_id=str(record_id) if record_id is not None else None,
        action=action,
        actor_user_id=actor_user_id,
        actor_api_key_id=actor_api_key_id,
        actor_app_user_id=actor_app_user_id,
        old_data_json=_safe_json_dumps(old_data),
        new_data_json=_safe_json_dumps(new_data),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(event)
    return event


# Auth action constants
AUTH_ACTION_REGISTER = "auth.register"
AUTH_ACTION_LOGIN = "auth.login"
AUTH_ACTION_LOGOUT = "auth.logout"
AUTH_ACTION_REFRESH = "auth.refresh"
AUTH_ACTION_PASSWORD_CHANGE = "auth.password_change"
AUTH_ACTION_PASSWORD_RESET = "auth.password_reset"
AUTH_ACTION_EMAIL_VERIFY = "auth.email_verify"
AUTH_ACTION_DISABLED = "auth.disabled"
AUTH_ACTION_ENABLED = "auth.enabled"


def log_auth_event(
    db: Session,
    project_id: str,
    action: str,
    app_user_id: str | None = None,
    email: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    success: bool = True,
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    """Log an authentication-related audit event."""
    new_data = {"email": email} if email else {}
    if details:
        new_data.update(details)
    new_data["success"] = success
    
    return log_audit_event(
        db=db,
        project_id=project_id,
        action=action,
        actor_app_user_id=app_user_id,
        new_data=new_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )


def list_audit_events(
    db: Session,
    project_id: str,
    collection_id: str | None = None,
    record_id: str | None = None,
    action: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
    actor_type: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[AuditEvent], int]:
    query = db.query(AuditEvent).filter(AuditEvent.project_id == project_id)
    
    if collection_id:
        query = query.filter(AuditEvent.collection_id == collection_id)
    if record_id:
        query = query.filter(AuditEvent.record_id == str(record_id))
    if action:
        query = query.filter(AuditEvent.action == action)
    if start_date:
        query = query.filter(AuditEvent.created_at >= start_date)
    if end_date:
        query = query.filter(AuditEvent.created_at <= end_date)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (AuditEvent.record_id.ilike(search_pattern)) |
            (AuditEvent.new_data_json.ilike(search_pattern)) |
            (AuditEvent.old_data_json.ilike(search_pattern)) |
            (AuditEvent.ip_address.ilike(search_pattern))
        )
    if actor_type:
        if actor_type == "admin_user":
            query = query.filter(AuditEvent.actor_user_id.isnot(None))
        elif actor_type == "app_user":
            query = query.filter(AuditEvent.actor_app_user_id.isnot(None))
        elif actor_type == "api_key":
            query = query.filter(AuditEvent.actor_api_key_id.isnot(None))
    
    total = query.count()
    events = query.order_by(AuditEvent.created_at.desc()).limit(limit).offset(offset).all()
    return events, total


def list_schema_ops(
    db: Session,
    project_id: str,
    collection_id: str | None = None,
    op_type: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[SchemaOp]:
    query = db.query(SchemaOp).filter(SchemaOp.project_id == project_id)
    
    if collection_id:
        query = query.filter(SchemaOp.collection_id == collection_id)
    if op_type:
        query = query.filter(SchemaOp.op_type == op_type)
    
    return query.order_by(SchemaOp.created_at.desc()).limit(limit).offset(offset).all()
