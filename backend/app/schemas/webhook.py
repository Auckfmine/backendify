from datetime import datetime

from pydantic import BaseModel, HttpUrl


class WebhookCreate(BaseModel):
    name: str
    url: str
    events: list[str]


class WebhookResponse(BaseModel):
    id: str
    project_id: str
    name: str
    url: str
    events: list[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WebhookCreateResponse(WebhookResponse):
    secret: str


class WebhookDeliveryResponse(BaseModel):
    id: str
    webhook_id: str
    event_type: str
    payload_json: str
    response_status: int | None
    response_body: str | None
    error: str | None
    attempts: int
    status: str
    created_at: datetime
    delivered_at: datetime | None

    class Config:
        from_attributes = True
