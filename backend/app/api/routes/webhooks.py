import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas.webhook import WebhookCreate, WebhookCreateResponse, WebhookResponse
from app.services import webhook_service

router = APIRouter()


@router.post("", response_model=WebhookCreateResponse, status_code=status.HTTP_201_CREATED)
def create_webhook(
    payload: WebhookCreate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    webhook, secret = webhook_service.create_webhook(
        db,
        project_id=project.id,
        name=payload.name,
        url=payload.url,
        events=payload.events,
    )
    return WebhookCreateResponse(
        id=webhook.id,
        project_id=webhook.project_id,
        name=webhook.name,
        url=webhook.url,
        events=json.loads(webhook.events),
        is_active=webhook.is_active,
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
        secret=secret,
    )


@router.get("", response_model=list[WebhookResponse])
def list_webhooks(
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    webhooks = webhook_service.list_webhooks(db, project.id)
    return [
        WebhookResponse(
            id=w.id,
            project_id=w.project_id,
            name=w.name,
            url=w.url,
            events=json.loads(w.events),
            is_active=w.is_active,
            created_at=w.created_at,
            updated_at=w.updated_at,
        )
        for w in webhooks
    ]


@router.get("/{webhook_id}", response_model=WebhookResponse)
def get_webhook(
    webhook_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    webhook = webhook_service.get_webhook(db, project.id, webhook_id)
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    return WebhookResponse(
        id=webhook.id,
        project_id=webhook.project_id,
        name=webhook.name,
        url=webhook.url,
        events=json.loads(webhook.events),
        is_active=webhook.is_active,
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
    )


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    webhook_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    deleted = webhook_service.delete_webhook(db, project.id, webhook_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")


@router.get("/{webhook_id}/deliveries")
def list_webhook_deliveries(
    webhook_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    webhook = webhook_service.get_webhook(db, project.id, webhook_id)
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    
    deliveries = webhook_service.list_deliveries(db, webhook_id)
    return [
        {
            "id": d.id,
            "event_type": d.event_type,
            "status": d.status,
            "attempts": d.attempts,
            "response_status": d.response_status,
            "error": d.error,
            "created_at": d.created_at,
            "delivered_at": d.delivered_at,
        }
        for d in deliveries
    ]
