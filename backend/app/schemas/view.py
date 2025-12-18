from pydantic import BaseModel, Field
from typing import Any


class FilterDef(BaseModel):
    field: str
    operator: str
    value: Any | None = None
    is_param: bool = False
    param_name: str | None = None


class SortDef(BaseModel):
    field: str
    desc: bool = False
    is_param: bool = False
    param_name: str | None = None
    desc_is_param: bool = False
    desc_param_name: str | None = None


class JoinDef(BaseModel):
    collection_id: str
    on_field: str
    target_field: str = "id"
    type: str = "left"


class ViewCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=63)
    display_name: str = Field(..., min_length=1, max_length=255)
    base_collection_id: str
    description: str | None = None
    projection: list[str] | None = None
    filters: list[FilterDef] | None = None
    sorts: list[SortDef] | None = None
    joins: list[JoinDef] | None = None
    params_schema: dict | None = None
    default_limit: int = 100
    max_limit: int = 1000


class ViewUpdate(BaseModel):
    display_name: str | None = None
    description: str | None = None
    projection: list[str] | None = None
    filters: list[FilterDef] | None = None
    sorts: list[SortDef] | None = None
    joins: list[JoinDef] | None = None
    params_schema: dict | None = None


class ViewOut(BaseModel):
    id: str
    name: str
    display_name: str
    description: str | None
    base_collection_id: str
    projection: list[str] | None
    filters: list[dict] | None
    sorts: list[dict] | None
    joins: list[dict] | None
    params_schema: dict | None
    default_limit: int
    max_limit: int
    version: int
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ViewVersionOut(BaseModel):
    id: str
    view_id: str
    version: int
    projection: list[str] | None
    filters: list[dict] | None
    sorts: list[dict] | None
    joins: list[dict] | None
    params_schema: dict | None
    created_at: str
    created_by_user_id: str | None

    class Config:
        from_attributes = True


class ViewExecuteRequest(BaseModel):
    params: dict[str, Any] | None = None
    limit: int | None = None
    offset: int = 0


class ViewExecuteResponse(BaseModel):
    data: list[dict[str, Any]]
    total: int
    limit: int
    offset: int
    view_name: str
    view_version: int
