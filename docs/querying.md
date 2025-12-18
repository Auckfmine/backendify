# Querying Data

Backendify provides a powerful query API for filtering, sorting, and paginating your data.

---

## Basic Queries

### List All Records

```bash
GET /api/projects/{project_id}/data/{collection}
```

### Get Single Record

```bash
GET /api/projects/{project_id}/data/{collection}/{id}
```

---

## Filtering

### Simple Equality

```bash
GET /api/projects/{project_id}/data/posts?status=published
GET /api/projects/{project_id}/data/users?role=admin
```

### Filter Operators

Use the `field__operator=value` syntax for advanced filtering:

```bash
GET /api/projects/{project_id}/data/products?price__gte=100&price__lte=500
```

### Available Operators

| Operator | SQL Equivalent | Example |
|----------|---------------|---------|
| `eq` | `=` | `?status=active` or `?status__eq=active` |
| `neq` | `!=` | `?status__neq=deleted` |
| `gt` | `>` | `?price__gt=100` |
| `gte` | `>=` | `?price__gte=100` |
| `lt` | `<` | `?price__lt=500` |
| `lte` | `<=` | `?price__lte=500` |
| `contains` | `LIKE %val%` | `?name__contains=john` |
| `startswith` | `LIKE val%` | `?name__startswith=A` |
| `endswith` | `LIKE %val` | `?email__endswith=@gmail.com` |
| `ilike` | `ILIKE %val%` | `?name__ilike=JOHN` (case-insensitive) |
| `in` | `IN (...)` | `?status__in=active,pending,review` |
| `notin` | `NOT IN (...)` | `?status__notin=deleted,archived` |
| `isnull` | `IS NULL` | `?deleted_at__isnull=true` |
| `isnotnull` | `IS NOT NULL` | `?email__isnotnull=true` |

---

## Sorting

Use the `sort` parameter to order results:

### Ascending Order

```bash
GET /api/projects/{project_id}/data/posts?sort=title
GET /api/projects/{project_id}/data/posts?sort=created_at
```

### Descending Order

Prefix with `-` for descending:

```bash
GET /api/projects/{project_id}/data/posts?sort=-created_at
```

### Multiple Sort Fields

Comma-separate multiple fields:

```bash
GET /api/projects/{project_id}/data/posts?sort=-created_at,title
```

This sorts by `created_at` descending first, then by `title` ascending.

---

## Pagination

### Parameters

| Parameter | Description | Default | Max |
|-----------|-------------|---------|-----|
| `limit` | Number of records to return | 100 | 1000 |
| `offset` | Number of records to skip | 0 | - |

### Example

```bash
# First page (records 1-50)
GET /api/projects/{project_id}/data/posts?limit=50&offset=0

# Second page (records 51-100)
GET /api/projects/{project_id}/data/posts?limit=50&offset=50
```

### Response Format

```json
{
  "records": [...],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

Use `total` to calculate the number of pages:
```javascript
const totalPages = Math.ceil(total / limit);
```

---

## Combining Filters

All query parameters can be combined:

```bash
GET /api/projects/{project_id}/data/posts?published=true&category_id=5&sort=-created_at&limit=10
```

This returns:
- Published posts
- In category 5
- Sorted by newest first
- Limited to 10 results

---

## System Fields

You can filter by system fields:

| Field | Description |
|-------|-------------|
| `id` | Record ID |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |
| `created_by_user_id` | Admin user who created |
| `created_by_app_user_id` | App user who created |

### Examples

```bash
# Records created by a specific user
GET /api/projects/{project_id}/data/posts?created_by_app_user_id=user-uuid

# Records created after a date
GET /api/projects/{project_id}/data/posts?created_at__gte=2024-01-01
```

---

## Query Examples

### E-commerce Products

```bash
# Products in price range, in stock, sorted by price
GET /data/products?price__gte=50&price__lte=200&in_stock=true&sort=price

# Search products by name
GET /data/products?name__contains=laptop&sort=-created_at
```

### Blog Posts

```bash
# Published posts in a category
GET /data/posts?published=true&category_id=3&sort=-created_at

# Posts by a specific author
GET /data/posts?author_id=user-123&sort=-created_at&limit=5
```

### User Management

```bash
# Active users with verified email
GET /data/users?status=active&email_verified=true

# Users registered this month
GET /data/users?created_at__gte=2024-01-01&sort=-created_at
```

---

## Performance Tips

1. **Use indexes** - Add indexes to frequently filtered fields
2. **Limit results** - Always use pagination for large datasets
3. **Be specific** - More filters = faster queries
4. **Avoid `contains` on large text** - Use `startswith` when possible
