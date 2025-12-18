import hashlib
import hmac
import json
import secrets
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.models.webhook import Webhook, WebhookDelivery


def _json_serializer(obj: Any) -> str:
    """Custom JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def generate_secret() -> str:
    return secrets.token_urlsafe(32)


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def sign_payload(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def create_webhook(
    db: Session,
    project_id: str,
    name: str,
    url: str,
    events: list[str],
) -> tuple[Webhook, str]:
    secret = generate_secret()
    webhook = Webhook(
        project_id=project_id,
        name=name,
        url=url,
        events=json.dumps(events),
        secret_hash=hash_secret(secret),
        is_active=True,
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    return webhook, secret


def list_webhooks(db: Session, project_id: str) -> list[Webhook]:
    return db.query(Webhook).filter(Webhook.project_id == project_id).all()


def get_webhook(db: Session, project_id: str, webhook_id: str) -> Webhook | None:
    return db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.project_id == project_id,
    ).first()


def delete_webhook(db: Session, project_id: str, webhook_id: str) -> bool:
    webhook = get_webhook(db, project_id, webhook_id)
    if not webhook:
        return False
    db.delete(webhook)
    db.commit()
    return True


def get_webhooks_for_event(db: Session, project_id: str, event_type: str) -> list[Webhook]:
    webhooks = db.query(Webhook).filter(
        Webhook.project_id == project_id,
        Webhook.is_active == True,
    ).all()
    
    result = []
    for webhook in webhooks:
        events = json.loads(webhook.events)
        if event_type in events or "*" in events:
            result.append(webhook)
    return result


def create_delivery(
    db: Session,
    webhook_id: str,
    event_type: str,
    payload: dict,
) -> WebhookDelivery:
    delivery = WebhookDelivery(
        webhook_id=webhook_id,
        event_type=event_type,
        payload_json=json.dumps(payload, default=_json_serializer),
        status="pending",
        attempts=0,
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return delivery


async def deliver_webhook(
    db: Session,
    delivery: WebhookDelivery,
    webhook: Webhook,
    secret: str | None = None,
) -> bool:
    payload = delivery.payload_json
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Event": delivery.event_type,
        "X-Webhook-Delivery": delivery.id,
    }
    
    if secret:
        signature = sign_payload(payload, secret)
        headers["X-Webhook-Signature"] = f"sha256={signature}"
    
    delivery.attempts += 1
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(webhook.url, content=payload, headers=headers)
            delivery.response_status = response.status_code
            delivery.response_body = response.text[:4096] if response.text else None
            
            if 200 <= response.status_code < 300:
                delivery.status = "delivered"
                delivery.delivered_at = datetime.utcnow()
                db.commit()
                return True
            else:
                delivery.status = "failed"
                db.commit()
                return False
    except Exception as e:
        delivery.error = str(e)[:1024]
        delivery.status = "failed"
        db.commit()
        return False


def emit_event(db: Session, project_id: str, event_type: str, payload: dict) -> list[WebhookDelivery]:
    webhooks = get_webhooks_for_event(db, project_id, event_type)
    deliveries = []
    
    for webhook in webhooks:
        delivery = create_delivery(db, webhook.id, event_type, payload)
        deliveries.append(delivery)
    
    return deliveries


def get_pending_deliveries(db: Session, max_attempts: int = 3) -> list[WebhookDelivery]:
    return db.query(WebhookDelivery).filter(
        WebhookDelivery.status.in_(["pending", "failed"]),
        WebhookDelivery.attempts < max_attempts,
    ).all()


def retry_failed_deliveries(db: Session, max_attempts: int = 3) -> int:
    deliveries = get_pending_deliveries(db, max_attempts)
    retried = 0
    
    for delivery in deliveries:
        webhook = db.query(Webhook).filter(Webhook.id == delivery.webhook_id).first()
        if webhook and webhook.is_active:
            delivery.status = "pending"
            retried += 1
    
    db.commit()
    return retried


def list_deliveries(db: Session, webhook_id: str, limit: int = 50) -> list[WebhookDelivery]:
    return db.query(WebhookDelivery).filter(
        WebhookDelivery.webhook_id == webhook_id,
    ).order_by(WebhookDelivery.created_at.desc()).limit(limit).all()
