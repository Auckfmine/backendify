from datetime import datetime

from pydantic import BaseModel


class AuditEventOut(BaseModel):
    id: str
    project_id: str
    collection_id: str | None
    record_id: str | None
    action: str
    actor_user_id: str | None
    actor_api_key_id: str | None
    actor_app_user_id: str | None
    old_data_json: str | None
    new_data_json: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SchemaOpOut(BaseModel):
    id: str
    project_id: str
    collection_id: str | None
    op_type: str
    payload_json: str
    status: str
    error: str | None
    actor_user_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
