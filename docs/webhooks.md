# Webhooks

Webhooks allow you to receive real-time notifications when events occur in your Backendify project.

---

## Overview

When configured, Backendify will send HTTP POST requests to your specified URL whenever certain events happen (e.g., record created, updated, deleted).

---

## Creating a Webhook

### Via Admin Console

1. Navigate to your project
2. Go to **Webhooks** tab
3. Click **Add Webhook**
4. Configure:
   - **URL**: Your endpoint (must be HTTPS in production)
   - **Events**: Which events to listen for
   - **Collections**: Which collections to monitor
   - **Secret**: For verifying webhook signatures

### Via API

```bash
POST /api/projects/{project_id}/webhooks
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "My Webhook",
  "url": "https://your-server.com/webhook",
  "events": ["record.created", "record.updated", "record.deleted"],
  "collections": ["posts", "comments"],
  "secret": "your-webhook-secret",
  "is_active": true
}
```

---

## Webhook Events

| Event | Description |
|-------|-------------|
| `record.created` | A new record was created |
| `record.updated` | An existing record was updated |
| `record.deleted` | A record was deleted |

---

## Webhook Payload

When an event occurs, Backendify sends a POST request with this payload:

```json
{
  "event": "record.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "project_id": "uuid",
  "collection": "posts",
  "record": {
    "id": 123,
    "title": "New Post",
    "content": "...",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "previous_record": null
}
```

For `record.updated`, `previous_record` contains the record before the update.

---

## Verifying Webhooks

Backendify signs webhook payloads using HMAC-SHA256. Verify the signature to ensure the request is authentic:

### Headers

| Header | Description |
|--------|-------------|
| `X-Webhook-Signature` | HMAC-SHA256 signature |
| `X-Webhook-Timestamp` | Unix timestamp |

### Verification Example (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, timestamp, secret) {
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Verification Example (Python)

```python
import hmac
import hashlib

def verify_webhook(payload: str, signature: str, timestamp: str, secret: str) -> bool:
    signed_payload = f"{timestamp}.{payload}"
    expected = hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

---

## Retry Policy

If your endpoint returns a non-2xx status code, Backendify will retry:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

After 5 failed attempts, the webhook delivery is marked as failed.

---

## Best Practices

1. **Respond quickly** - Return 200 within 5 seconds, process async
2. **Verify signatures** - Always validate webhook authenticity
3. **Handle duplicates** - Webhooks may be delivered more than once
4. **Use HTTPS** - Required for production webhooks
5. **Monitor failures** - Check webhook logs in the admin console
