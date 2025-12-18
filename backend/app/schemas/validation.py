from pydantic import BaseModel, Field
from typing import Any


class ValidationRuleCreate(BaseModel):
    rule_type: str
    config: dict | None = None
    error_message: str | None = None
    priority: int = 0


class ValidationRuleUpdate(BaseModel):
    config: dict | None = None
    error_message: str | None = None
    priority: int | None = None
    is_active: bool | None = None


class ValidationRuleOut(BaseModel):
    id: str
    field_id: str
    rule_type: str
    config: dict | None
    error_message: str | None
    priority: int
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ValidateRequest(BaseModel):
    data: dict[str, Any]


class ValidateResponse(BaseModel):
    is_valid: bool
    errors: dict[str, list[str]]
