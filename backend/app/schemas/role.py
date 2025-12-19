from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# Role schemas
class RoleBase(BaseModel):
    name: str = Field(..., max_length=63, description="Role identifier (e.g., admin, editor)")
    display_name: str = Field(..., max_length=127)
    description: Optional[str] = None
    is_default: bool = False


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=127)
    description: Optional[str] = None
    is_default: Optional[bool] = None


class RoleOut(RoleBase):
    id: str
    project_id: str
    is_system: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# App User Role schemas
class AppUserRoleCreate(BaseModel):
    role_id: str


class AppUserRoleOut(BaseModel):
    id: str
    app_user_id: str
    role_id: str
    assigned_by: Optional[str]
    assigned_at: datetime
    role: RoleOut

    class Config:
        from_attributes = True


# Bulk operations
class AssignRolesRequest(BaseModel):
    role_ids: List[str]


class UserRolesOut(BaseModel):
    app_user_id: str
    roles: List[RoleOut]
