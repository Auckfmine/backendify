from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dateutil import parser as date_parser

from app.api import deps
from app.schemas import AuditEventOut, SchemaOpOut
from app.services.audit_service import list_audit_events, list_schema_ops

router = APIRouter()


class AuditEventsResponse(BaseModel):
    events: list[AuditEventOut]
    total: int
    limit: int
    offset: int


def parse_datetime(value: str | None) -> datetime | None:
    """Parse datetime string, handling various formats including ISO 8601."""
    if not value:
        return None
    try:
        return date_parser.parse(value)
    except (ValueError, TypeError):
        return None


@router.get("/events", response_model=AuditEventsResponse)
def list_audit_events_endpoint(
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    collection_id: str | None = Query(default=None),
    record_id: str | None = Query(default=None),
    action: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    search: str | None = Query(default=None),
    actor_type: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    events, total = list_audit_events(
        db,
        project.id,
        collection_id=collection_id,
        record_id=record_id,
        action=action,
        start_date=parse_datetime(start_date),
        end_date=parse_datetime(end_date),
        search=search,
        actor_type=actor_type,
        limit=limit,
        offset=offset,
    )
    return AuditEventsResponse(events=events, total=total, limit=limit, offset=offset)


@router.get("/schema-ops", response_model=list[SchemaOpOut])
def list_schema_ops_endpoint(
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
    collection_id: str | None = Query(default=None),
    op_type: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    return list_schema_ops(
        db,
        project.id,
        collection_id=collection_id,
        op_type=op_type,
        limit=limit,
        offset=offset,
    )
