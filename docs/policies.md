# Policies & Access Control

Backendify uses a policy-based access control system that allows fine-grained permissions on your data.

---

## Overview

Policies define **who** can perform **what actions** on **which collections**. Each policy specifies:

- **Action**: The operation (`create`, `read`, `update`, `delete`, `list`)
- **Effect**: `allow` or `deny`
- **Allowed Principals**: Who can perform this action
- **Conditions**: Optional rules for row-level security

---

## Principal Types

| Principal | Description |
|-----------|-------------|
| `admin_user` | Console users (project owners) |
| `app_user` | End users authenticated via app auth |
| `api_key` | Server-to-server via API key |
| `anonymous` | Unauthenticated requests |

---

## Creating Policies

### Via API

```bash
POST /api/projects/{project_id}/schema/collections/{collection_name}/policies
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "action": "list",
  "effect": "allow",
  "allowed_principals": ["app_user", "anonymous"],
  "require_email_verified": false,
  "condition_json": null
}
```

### Via Admin Console

1. Navigate to your project
2. Go to **Policies** tab
3. Select a collection
4. Click **Add Policy**
5. Configure the policy settings

---

## Policy Examples

### Public Read Access

Allow anyone to read published posts:

```json
{
  "action": "read",
  "effect": "allow",
  "allowed_principals": ["anonymous", "app_user", "api_key"],
  "condition_json": null
}
```

### Authenticated Users Only

Only logged-in app users can create posts:

```json
{
  "action": "create",
  "effect": "allow",
  "allowed_principals": ["app_user"],
  "require_email_verified": false
}
```

### Verified Email Required

Only users with verified emails can create content:

```json
{
  "action": "create",
  "effect": "allow",
  "allowed_principals": ["app_user"],
  "require_email_verified": true
}
```

### Owner-Only Updates

Users can only update their own records:

```json
{
  "action": "update",
  "effect": "allow",
  "allowed_principals": ["app_user"],
  "condition_json": "{\"owner_field\": \"created_by_app_user_id\"}"
}
```

---

## Row-Level Security

### Owner Field Condition

The most common pattern is restricting access to records owned by the current user:

```json
{
  "condition_json": "{\"owner_field\": \"created_by_app_user_id\"}"
}
```

This ensures:
- **Read/List**: Users only see their own records
- **Update/Delete**: Users can only modify their own records

### System Fields

Every record automatically includes:

| Field | Description |
|-------|-------------|
| `id` | Auto-incrementing primary key |
| `created_at` | Timestamp when created |
| `updated_at` | Timestamp when last updated |
| `created_by_user_id` | Admin user who created (if applicable) |
| `created_by_app_user_id` | App user who created (if applicable) |

---

## Default Behavior

If no policies are defined for a collection:

- `admin_user` and `api_key` have full access
- `app_user` and `anonymous` are denied

**Always define explicit policies for production use.**

---

## Policy Evaluation Order

1. Check if user is `admin_user` → **Allow** (admins always have access)
2. Find matching policies for the action
3. Check if principal type is in `allowed_principals`
4. Check `require_email_verified` if set
5. Evaluate `condition_json` if present
6. If no matching policy → **Deny**

---

## Best Practices

1. **Start restrictive** - Add permissions as needed
2. **Use owner conditions** - Prevent users from accessing others' data
3. **Separate read/write** - Often you want public read but restricted write
4. **Test thoroughly** - Verify policies work as expected before production
5. **Document your policies** - Keep track of what each policy allows
