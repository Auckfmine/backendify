from pydantic import BaseModel, Field
from typing import Any


class RenameCollectionRequest(BaseModel):
    new_name: str = Field(..., min_length=1, max_length=63)
    new_display_name: str | None = None


class RenameFieldRequest(BaseModel):
    new_name: str = Field(..., min_length=1, max_length=63)
    new_display_name: str | None = None


class ChangeFieldTypeRequest(BaseModel):
    new_type: str = Field(..., min_length=1, max_length=32)


class PreviewMigrationRequest(BaseModel):
    operation: str
    params: dict[str, Any]


class SchemaOperationResponse(BaseModel):
    success: bool = True
    operation: str
    details: dict[str, Any]


class PreviewMigrationResponse(BaseModel):
    operation: str
    collection: str
    steps: list[str]
    warnings: list[str]
    params: dict[str, Any]


class AliasInfo(BaseModel):
    old_name: str
    collection_id: str | None = None
    field_id: str | None = None
    expires_at: str | None = None


class ActiveAliasesResponse(BaseModel):
    collection_aliases: list[AliasInfo]
    field_aliases: list[AliasInfo]
