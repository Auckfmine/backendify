from datetime import datetime

from pydantic import BaseModel, Field


class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=63, pattern=r"^[a-z][a-z0-9_]*$")
    display_name: str = Field(..., min_length=1, max_length=255)


class CollectionOut(BaseModel):
    id: str
    name: str
    display_name: str
    sql_table_name: str
    is_active: bool
    is_system: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FieldCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=63, pattern=r"^[a-z][a-z0-9_]*$")
    display_name: str = Field(..., min_length=1, max_length=255)
    field_type: str = Field(..., description="One of: string, int, float, bool, date, datetime, uuid")
    is_required: bool = False
    is_unique: bool = False
    is_indexed: bool = False
    default_value: str | None = None


class FieldOut(BaseModel):
    id: str
    name: str
    display_name: str
    field_type: str
    sql_column_name: str
    is_required: bool
    is_unique: bool
    is_indexed: bool
    default_value: str | None
    is_system: bool = False
    is_hidden: bool = False
    relation_target_collection_id: str | None = None
    relation_type: str | None = None
    relation_on_delete: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
