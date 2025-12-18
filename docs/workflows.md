# Workflows

Workflows allow you to automate actions and create custom logic that runs in response to events in your Backendify project.

---

## Overview

Workflows are event-driven automations that can:
- Transform data before saving
- Trigger external services
- Send notifications
- Chain multiple actions together

---

## Creating a Workflow

### Via Admin Console

1. Navigate to your project
2. Go to **Workflows** tab
3. Click **Add Workflow**
4. Configure trigger, conditions, and actions

### Via API

```bash
POST /api/projects/{project_id}/workflows
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "Send Welcome Email",
  "description": "Send email when new user registers",
  "trigger": {
    "type": "record.created",
    "collection": "users"
  },
  "conditions": [],
  "actions": [
    {
      "type": "webhook",
      "config": {
        "url": "https://api.email-service.com/send",
        "method": "POST",
        "body": {
          "to": "{{record.email}}",
          "template": "welcome"
        }
      }
    }
  ],
  "is_active": true
}
```

---

## Trigger Types

| Trigger | Description |
|---------|-------------|
| `record.created` | When a new record is created |
| `record.updated` | When a record is updated |
| `record.deleted` | When a record is deleted |
| `schedule` | Run on a schedule (cron) |

---

## Action Types

| Action | Description |
|--------|-------------|
| `webhook` | Send HTTP request to external URL |
| `transform` | Modify record data |
| `create_record` | Create a record in another collection |
| `update_record` | Update related records |
| `send_email` | Send email notification |

---

## Template Variables

Use `{{variable}}` syntax to reference data:

| Variable | Description |
|----------|-------------|
| `{{record}}` | The current record |
| `{{record.field_name}}` | Specific field value |
| `{{previous_record}}` | Previous record (for updates) |
| `{{user}}` | Current user info |
| `{{project}}` | Project info |

### Example

```json
{
  "type": "webhook",
  "config": {
    "url": "https://slack.com/api/chat.postMessage",
    "body": {
      "text": "New post created: {{record.title}} by {{user.email}}"
    }
  }
}
```

---

## Conditions

Add conditions to control when workflows run:

```json
{
  "conditions": [
    {
      "field": "status",
      "operator": "eq",
      "value": "published"
    }
  ]
}
```

### Operators

| Operator | Description |
|----------|-------------|
| `eq` | Equals |
| `neq` | Not equals |
| `gt`, `gte` | Greater than |
| `lt`, `lte` | Less than |
| `contains` | Contains string |
| `in` | Value in list |

---

## Workflow Execution

Workflows run asynchronously after the triggering action completes. This ensures:
- API responses are not delayed
- Workflow failures don't affect data operations
- Multiple workflows can run in parallel

---

## Monitoring

View workflow execution history in the admin console:
- Execution status (success/failed)
- Execution time
- Input/output data
- Error messages

---

## Best Practices

1. **Keep workflows simple** - One workflow, one purpose
2. **Handle failures gracefully** - External services may be unavailable
3. **Test thoroughly** - Use test data before enabling in production
4. **Monitor execution** - Check logs regularly
5. **Use conditions** - Avoid unnecessary workflow runs
