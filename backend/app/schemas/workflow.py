from datetime import datetime
from typing import Any

from pydantic import BaseModel


class WorkflowStepConfig(BaseModel):
    action: str
    config: dict[str, Any] = {}


class WorkflowCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_type: str
    trigger_config: dict[str, Any] = {}
    steps: list[dict[str, Any]] = []


class WorkflowResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None
    trigger_type: str
    trigger_config: dict[str, Any]
    steps: list[dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowRunResponse(BaseModel):
    id: str
    workflow_id: str
    trigger_data: dict[str, Any]
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    error: str | None
    created_at: datetime

    class Config:
        from_attributes = True
