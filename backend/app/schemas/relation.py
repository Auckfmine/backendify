from pydantic import BaseModel, Field
from typing import Any


class RelationFieldCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=63)
    display_name: str = Field(..., min_length=1, max_length=255)
    target_collection_id: str
    relation_type: str = "many_to_one"
    on_delete: str = "RESTRICT"
    display_field: str | None = None
    is_required: bool = False


class RelationFieldOut(BaseModel):
    id: str
    name: str
    display_name: str
    field_type: str
    sql_column_name: str
    is_required: bool
    relation_target_collection_id: str | None
    relation_type: str | None
    relation_on_delete: str | None
    relation_display_field: str | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class RelationInfo(BaseModel):
    target_collection_id: str | None
    relation_type: str | None
    on_delete: str | None
    display_field: str | None
