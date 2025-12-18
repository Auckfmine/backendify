# Field Validations

Backendify provides built-in validation rules to ensure data quality and integrity.

---

## Overview

Validations are rules applied to fields that:
- Validate data before saving
- Return clear error messages
- Prevent invalid data from entering your database

---

## Adding Validations

### Via Admin Console

1. Navigate to your project
2. Go to **Validations** tab
3. Select a collection and field
4. Add validation rules

### Via API

```bash
POST /api/projects/{project_id}/schema/collections/{collection}/fields/{field}/validations
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "rule_type": "min_length",
  "config_json": "{\"min\": 3}",
  "error_message": "Must be at least 3 characters"
}
```

---

## Available Validation Rules

### String Validations

| Rule | Config | Description |
|------|--------|-------------|
| `min_length` | `{"min": 3}` | Minimum character length |
| `max_length` | `{"max": 100}` | Maximum character length |
| `regex` | `{"pattern": "^[a-z]+$"}` | Match regex pattern |
| `email` | - | Valid email format |
| `url` | - | Valid URL format |
| `uuid` | - | Valid UUID format |
| `not_empty` | - | Cannot be empty string |

### Number Validations

| Rule | Config | Description |
|------|--------|-------------|
| `min_value` | `{"min": 0}` | Minimum value |
| `max_value` | `{"max": 1000}` | Maximum value |
| `range` | `{"min": 0, "max": 100}` | Value within range |

### Choice Validations

| Rule | Config | Description |
|------|--------|-------------|
| `enum` | `{"values": ["a", "b", "c"]}` | Value must be in list |

### Date Validations

| Rule | Config | Description |
|------|--------|-------------|
| `date_format` | `{"format": "YYYY-MM-DD"}` | Match date format |

---

## Examples

### Email Field

```json
{
  "rule_type": "email",
  "error_message": "Please enter a valid email address"
}
```

### Password Field

```json
[
  {
    "rule_type": "min_length",
    "config_json": "{\"min\": 8}",
    "error_message": "Password must be at least 8 characters"
  },
  {
    "rule_type": "regex",
    "config_json": "{\"pattern\": \"^(?=.*[A-Z])(?=.*[0-9])\"}",
    "error_message": "Password must contain uppercase and number"
  }
]
```

### Status Field

```json
{
  "rule_type": "enum",
  "config_json": "{\"values\": [\"draft\", \"pending\", \"published\", \"archived\"]}",
  "error_message": "Invalid status value"
}
```

### Price Field

```json
{
  "rule_type": "range",
  "config_json": "{\"min\": 0, \"max\": 999999.99}",
  "error_message": "Price must be between 0 and 999,999.99"
}
```

### Slug Field

```json
{
  "rule_type": "regex",
  "config_json": "{\"pattern\": \"^[a-z0-9-]+$\"}",
  "error_message": "Slug can only contain lowercase letters, numbers, and hyphens"
}
```

---

## Validation Response

When validation fails, the API returns a 422 error:

```json
{
  "detail": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Please enter a valid email address"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

---

## Multiple Rules

A field can have multiple validation rules. All rules must pass:

```bash
# Add first rule
POST /api/projects/{project_id}/schema/collections/users/fields/username/validations
{
  "rule_type": "min_length",
  "config_json": "{\"min\": 3}",
  "error_message": "Username must be at least 3 characters"
}

# Add second rule
POST /api/projects/{project_id}/schema/collections/users/fields/username/validations
{
  "rule_type": "max_length",
  "config_json": "{\"max\": 20}",
  "error_message": "Username cannot exceed 20 characters"
}

# Add third rule
POST /api/projects/{project_id}/schema/collections/users/fields/username/validations
{
  "rule_type": "regex",
  "config_json": "{\"pattern\": \"^[a-zA-Z0-9_]+$\"}",
  "error_message": "Username can only contain letters, numbers, and underscores"
}
```

---

## Listing Validations

```bash
GET /api/projects/{project_id}/schema/collections/{collection}/fields/{field}/validations
```

---

## Removing Validations

```bash
DELETE /api/projects/{project_id}/schema/collections/{collection}/fields/{field}/validations/{rule_id}
```

---

## Best Practices

1. **Validate early** - Catch errors at the API level
2. **Clear messages** - Help users understand what's wrong
3. **Be consistent** - Use similar validation across similar fields
4. **Don't over-validate** - Only add necessary rules
5. **Test edge cases** - Verify validations work as expected
