# Relations

Backendify supports relational data through `belongs_to` and `has_many` relationships.

---

## Overview

Relations allow you to:
- Connect data across collections
- Define foreign key relationships
- Query related data efficiently

---

## Relation Types

### belongs_to (Many-to-One)

A record belongs to one parent record.

**Example:** A Post belongs to a Category

```
Posts                    Categories
┌─────────────────┐      ┌─────────────────┐
│ id              │      │ id              │
│ title           │      │ name            │
│ category_id ────┼─────►│ slug            │
│ content         │      └─────────────────┘
└─────────────────┘
```

### has_many (One-to-Many)

A record has many child records.

**Example:** A Post has many Comments

```
Posts                    Comments
┌─────────────────┐      ┌─────────────────┐
│ id ◄────────────┼──────┤ post_id         │
│ title           │      │ content         │
│ content         │      │ author_id       │
└─────────────────┘      └─────────────────┘
```

---

## Creating Relations

### Via Admin Console

1. Navigate to your project
2. Go to **Relations** tab
3. Click **Add Relation**
4. Configure source, target, and type

### Via API

#### belongs_to Relation

```bash
POST /api/projects/{project_id}/schema/relations
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "post_category",
  "source_collection": "posts",
  "target_collection": "categories",
  "relation_type": "belongs_to",
  "source_field": "category_id"
}
```

#### has_many Relation

```bash
POST /api/projects/{project_id}/schema/relations
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "post_comments",
  "source_collection": "posts",
  "target_collection": "comments",
  "relation_type": "has_many",
  "target_field": "post_id"
}
```

---

## Querying Related Data

### Filter by Related Field

Get posts in a specific category:

```bash
GET /api/projects/{project_id}/data/posts?category_id=5
```

Get comments for a specific post:

```bash
GET /api/projects/{project_id}/data/comments?post_id=123
```

---

## Relation Fields

When creating a `belongs_to` relation, you need a foreign key field:

1. Create the field first:

```bash
POST /api/projects/{project_id}/schema/collections/posts/fields
{
  "name": "Category",
  "field_type": "int",
  "is_required": false,
  "is_indexed": true
}
```

2. Then create the relation:

```bash
POST /api/projects/{project_id}/schema/relations
{
  "name": "post_category",
  "source_collection": "posts",
  "target_collection": "categories",
  "relation_type": "belongs_to",
  "source_field": "category_id"
}
```

---

## Listing Relations

```bash
GET /api/projects/{project_id}/schema/relations
```

**Response:**
```json
{
  "relations": [
    {
      "id": "relation-uuid",
      "name": "post_category",
      "source_collection": "posts",
      "target_collection": "categories",
      "relation_type": "belongs_to",
      "source_field": "category_id"
    },
    {
      "id": "relation-uuid",
      "name": "post_comments",
      "source_collection": "posts",
      "target_collection": "comments",
      "relation_type": "has_many",
      "target_field": "post_id"
    }
  ]
}
```

---

## Deleting Relations

```bash
DELETE /api/projects/{project_id}/schema/relations/{relation_id}
```

Note: This removes the relation metadata but does not delete the foreign key field or data.

---

## Common Patterns

### User Ownership

Every record tracks who created it:

```bash
# Posts belong to users (authors)
{
  "name": "post_author",
  "source_collection": "posts",
  "target_collection": "users",
  "relation_type": "belongs_to",
  "source_field": "author_id"
}
```

### Categories and Tags

Hierarchical categorization:

```bash
# Posts belong to categories
{
  "name": "post_category",
  "source_collection": "posts",
  "target_collection": "categories",
  "relation_type": "belongs_to",
  "source_field": "category_id"
}
```

### Comments and Replies

Nested comments:

```bash
# Comments belong to posts
{
  "name": "comment_post",
  "source_collection": "comments",
  "target_collection": "posts",
  "relation_type": "belongs_to",
  "source_field": "post_id"
}

# Comments can have parent comments (replies)
{
  "name": "comment_parent",
  "source_collection": "comments",
  "target_collection": "comments",
  "relation_type": "belongs_to",
  "source_field": "parent_id"
}
```

---

## Best Practices

1. **Index foreign keys** - Always index relation fields for performance
2. **Use meaningful names** - Name relations clearly (e.g., `post_author`, not `relation1`)
3. **Consider cascading** - Plan what happens when parent records are deleted
4. **Keep it simple** - Avoid deeply nested relations
5. **Document relationships** - Keep track of your data model
