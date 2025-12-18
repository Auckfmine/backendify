# Views

Views allow you to create virtual collections that combine, filter, or transform data from your existing collections.

---

## Overview

Views are read-only virtual tables that:
- Join data from multiple collections
- Pre-filter records
- Aggregate data
- Expose computed fields

---

## Creating a View

### Via Admin Console

1. Navigate to your project
2. Go to **Views** tab
3. Click **Create View**
4. Define the view query

### Via API

```bash
POST /api/projects/{project_id}/views
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "Published Posts with Authors",
  "slug": "published_posts_with_authors",
  "description": "All published posts with author information",
  "source_collection": "posts",
  "joins": [
    {
      "collection": "users",
      "local_field": "author_id",
      "foreign_field": "id",
      "alias": "author"
    }
  ],
  "filters": [
    {
      "field": "published",
      "operator": "eq",
      "value": true
    }
  ],
  "fields": [
    "id",
    "title",
    "content",
    "created_at",
    "author.name",
    "author.email"
  ]
}
```

---

## Querying Views

Views are queried just like regular collections:

```bash
GET /api/projects/{project_id}/data/{view_slug}
```

All standard query parameters work:
- Filtering: `?title__contains=hello`
- Sorting: `?sort=-created_at`
- Pagination: `?limit=10&offset=0`

---

## View Components

### Source Collection

The primary collection the view is based on.

### Joins

Connect related collections:

```json
{
  "joins": [
    {
      "collection": "categories",
      "local_field": "category_id",
      "foreign_field": "id",
      "alias": "category",
      "type": "left"
    }
  ]
}
```

Join types:
- `left` - Include all source records
- `inner` - Only include matching records

### Filters

Pre-filter the view data:

```json
{
  "filters": [
    {
      "field": "status",
      "operator": "eq",
      "value": "active"
    },
    {
      "field": "deleted_at",
      "operator": "isnull",
      "value": true
    }
  ]
}
```

### Field Selection

Choose which fields to expose:

```json
{
  "fields": [
    "id",
    "title",
    "category.name as category_name",
    "author.email"
  ]
}
```

---

## Use Cases

### Dashboard Metrics

Create a view that aggregates data for dashboards:

```json
{
  "name": "Order Summary",
  "source_collection": "orders",
  "aggregations": [
    {"field": "total", "function": "sum", "alias": "total_revenue"},
    {"field": "id", "function": "count", "alias": "order_count"}
  ],
  "group_by": ["status"]
}
```

### User-Friendly Data

Hide internal fields and rename columns:

```json
{
  "name": "Public Products",
  "source_collection": "products",
  "filters": [{"field": "is_public", "operator": "eq", "value": true}],
  "fields": [
    "id",
    "name",
    "description",
    "price",
    "image_url"
  ]
}
```

### Denormalized Data

Flatten related data for easier consumption:

```json
{
  "name": "Orders with Details",
  "source_collection": "orders",
  "joins": [
    {"collection": "users", "local_field": "user_id", "foreign_field": "id", "alias": "customer"},
    {"collection": "products", "local_field": "product_id", "foreign_field": "id", "alias": "product"}
  ],
  "fields": [
    "id",
    "quantity",
    "total",
    "customer.name",
    "customer.email",
    "product.name",
    "product.price"
  ]
}
```

---

## Policies on Views

Views inherit policies from their source collection by default. You can also define view-specific policies.

---

## Limitations

- Views are read-only
- Complex aggregations may impact performance
- Deeply nested joins are not supported

---

## Best Practices

1. **Use views for common queries** - Avoid repeating complex joins
2. **Keep views focused** - One view, one purpose
3. **Index source fields** - Ensure joined fields are indexed
4. **Test performance** - Monitor query times for complex views
