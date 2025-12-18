from datetime import datetime

from pydantic import BaseModel, Field


class PolicyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=63)
    action: str = Field(..., description="One of: create, read, update, delete, list")
    effect: str = Field(default="allow", description="One of: allow, deny")
    condition_json: str | None = Field(default=None, description="JSON condition for row-level rules")
    priority: int = Field(default=0, description="Higher priority policies are evaluated first")
    allowed_principals: str | None = Field(default=None, description="Comma-separated list: admin_user,app_user,api_key,anonymous")
    require_email_verified: bool = Field(default=False, description="Require app_user to have verified email")


class PolicyUpdate(BaseModel):
    name: str | None = None
    effect: str | None = None
    condition_json: str | None = None
    priority: int | None = None
    is_active: bool | None = None
    allowed_principals: str | None = None
    require_email_verified: bool | None = None


class PolicyOut(BaseModel):
    id: str
    collection_id: str
    name: str
    action: str
    effect: str
    condition_json: str | None
    is_active: bool
    priority: int
    allowed_principals: str | None
    require_email_verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
