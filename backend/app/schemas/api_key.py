from datetime import datetime

from pydantic import BaseModel


class ApiKeyCreate(BaseModel):
    name: str


class ApiKeyCreated(BaseModel):
    id: str
    name: str
    prefix: str
    api_key: str

    model_config = {"from_attributes": True}


class ApiKeyOut(BaseModel):
    id: str
    name: str
    prefix: str
    revoked: bool
    created_at: datetime

    model_config = {"from_attributes": True}
