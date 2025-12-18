# Schema Builder Guide

The Schema Builder allows you to define your data structure without writing SQL or migrations.

---

## Collections

Collections are equivalent to database tables. Each collection has:

- **Name**: Human-readable name (e.g., "Blog Posts")
- **Slug**: URL-friendly identifier (e.g., "posts")
- **Fields**: The columns/properties of your data

### Create a Collection

#### Via Admin Console

1. Navigate to your project
2. Go to **Schema Builder**
3. Click **New Collection**
4. Enter name and configure fields

#### Via API

```bash
POST /api/projects/{project_id}/schema/collections
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "Blog Posts",
  "description": "Articles for the blog"
}
```

---

## Field Types

| Type | Description | Example Values |
|------|-------------|----------------|
| `string` | Short text (VARCHAR) | "Hello", "user@email.com" |
| `text` | Long text (TEXT) | Article content, descriptions |
| `int` | Integer numbers | 1, 42, -100 |
| `float` | Decimal numbers | 3.14, 99.99 |
| `boolean` | True/False | true, false |
| `datetime` | Date and time | "2024-01-15T10:30:00Z" |
| `json` | JSON data | {"key": "value"} |

### Create a Field

```bash
POST /api/projects/{project_id}/schema/collections/{collection_name}/fields
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "Title",
  "field_type": "string",
  "is_required": true,
  "is_unique": false,
  "is_indexed": true,
  "default_value": null
}
```

---

## Field Options

| Option | Description |
|--------|-------------|
| `is_required` | Field cannot be null |
| `is_unique` | Values must be unique across records |
| `is_indexed` | Create database index for faster queries |
| `default_value` | Default value if not provided |

---

## Relationships

Backendify supports relational data through `belongs_to` and `has_many` relationships.

### belongs_to (Many-to-One)

A post belongs to a category:

```bash
POST /api/projects/{project_id}/schema/collections/posts/fields
{
  "name": "Category",
  "field_type": "int",
  "is_required": false
}

POST /api/projects/{project_id}/schema/relations
{
  "name": "post_category",
  "source_collection": "posts",
  "target_collection": "categories",
  "relation_type": "belongs_to",
  "source_field": "category_id"
}
```

### has_many (One-to-Many)

A post has many comments:

```bash
POST /api/projects/{project_id}/schema/relations
{
  "name": "post_comments",
  "source_collection": "posts",
  "target_collection": "comments",
  "relation_type": "has_many",
  "target_field": "post_id"
}
```

---

## System Fields

Every collection automatically includes these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | bigint | Auto-incrementing primary key |
| `created_at` | datetime | When the record was created |
| `updated_at` | datetime | When the record was last updated |
| `created_by_user_id` | uuid | Admin user who created (nullable) |
| `created_by_app_user_id` | uuid | App user who created (nullable) |

---

## Validation Rules

Add validation rules to ensure data quality:

### Available Rules

| Rule | Applies To | Config |
|------|-----------|--------|
| `min_length` | string, text | `{"min": 3}` |
| `max_length` | string, text | `{"max": 100}` |
| `regex` | string | `{"pattern": "^[a-z]+$"}` |
| `email` | string | - |
| `url` | string | - |
| `uuid` | string | - |
| `min_value` | int, float | `{"min": 0}` |
| `max_value` | int, float | `{"max": 1000}` |
| `range` | int, float | `{"min": 0, "max": 100}` |
| `enum` | string | `{"values": ["draft", "published"]}` |
| `not_empty` | string, text | - |

### Add Validation

```bash
POST /api/projects/{project_id}/schema/collections/{collection}/fields/{field}/validations
{
  "rule_type": "min_length",
  "config_json": "{\"min\": 3}",
  "error_message": "Title must be at least 3 characters"
}
```

---

## Schema Evolution

Backendify tracks schema changes and applies them automatically:

1. **Add Field**: New column added with default value
2. **Remove Field**: Column marked as deleted (soft delete)
3. **Modify Field**: Type changes applied when safe

### View Pending Changes

```bash
GET /api/projects/{project_id}/schema/evolution/pending
```

### Apply Changes

```bash
POST /api/projects/{project_id}/schema/evolution/apply
```

---

## Best Practices

1. **Plan your schema** - Think about relationships before creating collections
2. **Use meaningful names** - Clear field names make APIs self-documenting
3. **Add indexes** - Index fields you'll filter or sort by frequently
4. **Validate early** - Add validation rules to catch bad data at the API level
5. **Use appropriate types** - Don't store numbers as strings
