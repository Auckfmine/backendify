# Audit Logs

Backendify automatically logs all data operations for security, debugging, and compliance purposes.

---

## Overview

Audit logs capture:
- Who performed an action
- What action was performed
- When it happened
- What data was affected

---

## Viewing Logs

### Via Admin Console

1. Navigate to your project
2. Go to **Logs** tab
3. Filter and search logs

### Via API

```bash
GET /api/projects/{project_id}/audit
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "logs": [
    {
      "id": "log-uuid",
      "action": "create",
      "collection": "posts",
      "record_id": 123,
      "user_id": "user-uuid",
      "user_type": "app_user",
      "timestamp": "2024-01-15T10:30:00Z",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "changes": {
        "title": {"new": "Hello World"},
        "content": {"new": "..."}
      }
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

---

## Log Entry Fields

| Field | Description |
|-------|-------------|
| `id` | Unique log identifier |
| `action` | Operation type (create, read, update, delete) |
| `collection` | Affected collection |
| `record_id` | Affected record ID |
| `user_id` | User who performed action |
| `user_type` | Type of user (admin_user, app_user, api_key) |
| `timestamp` | When the action occurred |
| `ip_address` | Client IP address |
| `user_agent` | Client user agent |
| `changes` | Data changes (for create/update) |

---

## Filtering Logs

### By Action

```bash
GET /api/projects/{project_id}/audit?action=delete
```

### By Collection

```bash
GET /api/projects/{project_id}/audit?collection=posts
```

### By User

```bash
GET /api/projects/{project_id}/audit?user_id=user-uuid
```

### By Date Range

```bash
GET /api/projects/{project_id}/audit?from=2024-01-01&to=2024-01-31
```

### Combined Filters

```bash
GET /api/projects/{project_id}/audit?collection=posts&action=update&from=2024-01-01
```

---

## Change Tracking

For `update` actions, logs include before and after values:

```json
{
  "changes": {
    "title": {
      "old": "Draft Post",
      "new": "Published Post"
    },
    "status": {
      "old": "draft",
      "new": "published"
    }
  }
}
```

---

## Log Retention

| Plan | Retention Period |
|------|-----------------|
| Free | 7 days |
| Pro | 30 days |
| Enterprise | 1 year+ |

---

## Exporting Logs

Export logs for external analysis:

```bash
GET /api/projects/{project_id}/audit/export?format=csv
GET /api/projects/{project_id}/audit/export?format=json
```

---

## Use Cases

### Security Auditing

Track who accessed sensitive data:

```bash
GET /api/projects/{project_id}/audit?collection=users&action=read
```

### Debugging

Find when a record was modified:

```bash
GET /api/projects/{project_id}/audit?record_id=123
```

### Compliance

Generate reports for regulatory requirements:

```bash
GET /api/projects/{project_id}/audit?from=2024-01-01&to=2024-03-31&format=csv
```

---

## Best Practices

1. **Review regularly** - Check logs for suspicious activity
2. **Set up alerts** - Monitor for unusual patterns
3. **Export for backup** - Keep long-term records externally
4. **Use with policies** - Combine with access policies for security
