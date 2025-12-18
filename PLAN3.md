# PLAN — No-Code BaaS (Next Phase v3) — Milestones J → Q

This plan starts **after** you have already implemented:
- No-code Collections/Fields (real SQL tables), generated CRUD
- Policies + basic row rules
- Audit/schema ops logs
- Jobs + Webhooks + Workflows foundation
- Admin UI: builder + data explorer + logs

Goal of v3: make the platform **sticky, scalable, and truly product-building no-code** while staying safe with real Postgres tables.

---

## 0) Guiding principles (must not break)
1) **No-code always**: end users configure via UI; no SQL or code required.
2) **Safety first**: schema evolution must be guarded, logged, reversible where possible.
3) **Backward compatibility**: generated APIs should survive schema changes (at least with aliases/grace periods).
4) **Observability**: every action produces logs + events.
5) **Multi-tenant isolation**: keep schema-per-project boundaries (`p_<project_id>`).

---

## Milestone J — Schema Evolution v2 (real-life changes, safely)

### Objective
Allow users to evolve their schemas beyond “create + add field” without breaking data or clients.

### Features (v1 of schema evolution)
J1. Rename collection (table rename)
- UI: rename action with warnings and impact preview
- DB: `ALTER TABLE ... RENAME TO ...`
- Catalog: update `collections.name/display_name/sql_table_name`
- Compatibility: keep **alias mapping** for old name for a grace period

J2. Rename field (column rename)
- DB: `ALTER TABLE ... RENAME COLUMN ...`
- Catalog: update `fields.name/display_name/sql_column_name`
- Compatibility: keep alias from old field name → new field name for reads/writes during grace period

J3. Drop field (soft drop first)
- Phase 1 (default): soft-delete in catalog (`is_deleted=true`), hide from UI, stop accepting writes
- Phase 2 (admin-only): physical drop after retention window
- DB drop requires explicit confirmation and safety checks (no dependencies, no indexes)

J4. Change field type (safe conversions only)
- Supported conversions (initial):
  - `int → float`
  - `string → text` (no-op if already text)
  - `date → datetime` (convert at midnight UTC or configured TZ)
- Anything else requires “create new column + migrate + swap” wizard

J5. Migration preview + “apply” step
- UI shows generated DDL steps (read-only preview)
- Apply action creates `schema_ops` entry with full payload and status transitions

### Hard requirements
- Use Postgres advisory lock per project/collection for all DDL
- Ensure catalog + DDL are coordinated; no partial broken state
- All changes must create `schema_ops` + `audit_event`

### Acceptance criteria
- Rename table/column works end-to-end; old API names still work during grace period
- Drop field hides in UI and blocks writes immediately
- Type changes only allow safe list; unsafe attempts show guided wizard
- Tests cover each operation, including failure paths

---

## Milestone K — Relationships (No-code reference fields)

### Objective
Provide relational modeling without code: references, integrity, and controlled expansion.

### Features
K1. Field type `relation`
- `many_to_one` (most important): Order → Customer
- Optional `one_to_many` as derived relation (not stored, computed via reverse lookup)
- Storage: foreign key column `<field>_id` (bigint) referencing target table `id`

K2. Referential actions (configurable)
- `RESTRICT` (default)
- `CASCADE` (optional)
- `SET NULL` (optional)

K3. UI relationship builder
- Select target collection
- Choose display field (for UI)
- Configure referential action

K4. API enhancements
- Writes: allow setting relation by `{customer_id: 123}`
- Reads: allow bounded include/expand:
  - `?include=customer` (single hop only in v1)
- Filtering: `filter[customer_id]=123`

### Guardrails
- Limit includes to one hop; cap payload size
- Prevent circular includes
- Ensure policies apply to included records too

### Acceptance criteria
- Can create relation fields from UI
- FK constraints are created safely
- CRUD supports linking/unlinking
- Include works, policy-safe, performance-capped

---

## Milestone L — No-code Query Builder (Views)

### Objective
Let users create “endpoints” as saved queries (views) without writing SQL.

### Concepts
- **View** = saved query definition + output projection + parameters
- Views generate read-only APIs (v1):
  - `GET /api/projects/{project_id}/views/{view_name}`
- Later: materialized views (optional)

### Features
L1. View catalog
- `views` table:
  - name, description, base_collection, projection, filters, sorts, joins (limited), params schema
- Versioning:
  - view versions stored; active version pointer

L2. Query builder UI
- Choose base collection
- Select columns (projection)
- Add filters (operators v1):
  - `=`, `!=`, `in`, `contains` (strings), `gt/lt` (numbers/dates)
- Sort + limit + pagination
- Optional relation join (from K) limited to 1 join in v1

L3. Runtime execution engine
- Translate view definition into safe SQLAlchemy query (no raw SQL)
- Enforce max limits: max joins, max filters, max rows per request
- Enforce policies + row rules of all involved collections

L4. Parameterized views
- Example: “Orders by customer” with param `customer_id`
- UI defines params and binds them into filters

## Milestone L5 — View Usage Contract + Endpoint Descriptor (NEW)

### Objective
When a view is created, the platform must also provide **self-documenting usage info**
so end users know how to call the generated route in their frontend (filtering, sorting,
pagination, parameters) and can test it in Postman easily.

### L5.1 Standard query contract (applies to Views and optionally Collections)
Define a **single** query language for:
- pagination
- sorting
- filtering operators

Recommended baseline:
- `limit` (default + max enforced)
- `cursor` (opaque cursor returned by API)
- `sort=field:asc|desc`
- `filter[field][op]=value` where `op ∈ {eq, ne, in, contains, gt, lt, between}`
- view parameters remain first-class query params (e.g. `customer_id=123`)

Response shape (recommended):
```json
{
  "data": [...],
  "page": { "limit": 25, "next_cursor": "..." }
}
```

### L5.2 View Meta endpoint (machine-readable)

Add:

GET /api/projects/{project_id}/views/{view_name}/meta

It must return:

endpoint URL template

required/optional params with types + examples

allowed filter fields and supported operators

allowed sort fields + default sort

pagination mode + limits

response schema (fields returned)

example requests (curl + fetch snippet + Postman-friendly URL)

### L5.3 “API & Usage” UI panel

In the View detail page add a tab:

Endpoint URL

Auth method (JWT vs API key)

Params table (name/type/required/example)

Filter/sort/pagination documentation

Copy buttons:

cURL

fetch (TS)

Axios (optional)

Postman request snippet

### Acceptance criteria
- Users can build a view visually and call its endpoint
- Views respect permissions and row rules
- Views are versioned and rollbackable
- Tests cover query correctness + policy enforcement

---

## Milestone M — No-code Validation Rules (Business constraints)

### Objective
Move business logic into the platform: enforce rules on writes without code.

### Features
M1. Field-level validation rules
- min/max length (string)
- min/max value (numbers)
- regex pattern (string)
- allowed values (enum-like)
- required-if: condition-based required fields

M2. Record-level rules
- Conditional rules:
  - “If `status = paid` then `invoice_id` required”
- Uniqueness across multiple fields (compound unique index wizard)

M3. Validation testing UI
- “Try input” panel: user can test a payload against the rules

M4. Error model
- Return field-level errors:
  - `{ errors: [{ field, code, message }] }`

### Implementation constraints
- No code execution from user
- Use a safe expression system for conditions:
  - limited operators, no loops, no function calls
- Rules stored in catalog (`field_rules`, `record_rules`)

### Acceptance criteria
- Invalid writes are rejected consistently via API and UI
- Rule evaluation is deterministic and auditable
- Tests cover at least 5 rule types and combinations

---

## Milestone N — File Storage as a first-class No-code field

### Objective
Support file uploads/downloads as part of no-code data models.

### Features
N1. Storage backend
- MinIO (local/dev) + S3-compatible in prod
- `files` table (platform):
  - id, project_id, bucket, object_key, size, content_type, checksum, created_at, created_by

N2. Field type `file`
- Stored in data tables as `file_id` referencing `files.id` (or `uuid`)
- UI: upload control, preview/download link

N3. Signed URLs
- `POST /files/upload-url` → signed PUT
- `GET /files/download-url` → signed GET
- Optional: direct proxy download endpoint

N4. Policy enforcement
- File access respects project and collection policies
- Optional: file linked to a record and inherits its permissions

### Acceptance criteria
- Upload works from UI and API
- Files are scoped to project and protected
- Limits (max file size, allowed types) configurable per project

---

## Milestone O — Realtime subscriptions (No-code “live” data)

### Objective
Enable live updates for collections and views (like Firebase/Supabase).

### Features
O1. Realtime transport
- SSE (simpler) or WebSocket (richer); pick one for v1
- Endpoint:
  - `/api/projects/{project_id}/realtime/collections/{collection}`
  - `/api/projects/{project_id}/realtime/views/{view}`

O2. Event emission
- On insert/update/delete emit events:
  - `{ type, collection, id, changed_fields, ts }`
- Include a cursor for replay

O3. Policy enforcement
- Only send events user is allowed to see
- For API keys: enforce scope restrictions

O4. UI integration
- Data explorer live refresh option
- View page live refresh option

### Acceptance criteria
- Subscriptions receive updates in real time
- Events are filtered by permissions/row rules
- Basic resilience: reconnect + resume cursor

---

## Milestone P — Billing, quotas, and usage limits

### Objective
Make the platform operable as a hosted service or internal platform.

### Features
P1. Usage tracking
- Per project:
  - requests/day
  - stored rows (per collection and total)
  - storage bytes
  - workflow runs
  - webhook deliveries
- Store in `project_usage_daily`

P2. Quotas and limits
- Configurable plan limits:
  - max collections, max fields, max rows, max storage, max requests/min
- Enforce limits at runtime with clear errors and headers

P3. UI dashboards
- Usage charts + current limits
- Warnings when approaching limits

### Acceptance criteria
- Limits are enforced consistently
- Usage dashboards show accurate numbers
- Tests cover quota violations

---

## Milestone Q — Reliability & Ops (backup/restore + DR)

### Objective
Ensure you can recover from mistakes and outages.

### Features
Q1. Backup/restore per project
- Backup includes:
  - project schema tables + data
  - catalog entries for collections/fields/views/rules/policies
  - optionally: files metadata (and objects if configured)
- Provide:
  - “Export project” (UI) + CLI admin tool
  - “Restore project” into new project id (recommended safer restore path)

Q2. Disaster recovery runbook
- Document:
  - how to backup
  - how to restore
  - how to validate integrity
  - how to rotate secrets

Q3. Migration safety
- Add preflight checks for DDL:
  - locks, dependencies, estimated duration
- Add “maintenance mode” per project for schema changes (optional)

Q4. Observability pack
- Metrics: request count, error count, queue depth, webhook failures, realtime clients
- Tracing optional
- Alerting rules documented

### Acceptance criteria
- You can export and restore a project end-to-end
- Restore produces a working project with same behavior
- Runbook is tested at least once (document outcome)

---

## 1) Recommended execution order
Default order (best dependency flow):
1) J (Schema evolution)
2) K (Relationships)
3) L (Views)
4) M (Validation rules)
5) N (Files)
6) O (Realtime)
7) P (Quotas)
8) Q (Backup/restore + ops)

---

## 2) Definition of Done (global)
A milestone is “done” only when:
- All DB changes are migrated and tested on a fresh DB
- UI flow exists (no-code configuration)
- OpenAPI docs reflect new endpoints
- `schema_ops` + `audit_events` record all critical operations
- Tests include at least:
  - happy path
  - policy/permission denial
  - one failure path (e.g., invalid schema change)

---

## 3) Security and safety guardrails (non-negotiable)
- No raw SQL from users (ever)
- DDL locked with Postgres advisory locks
- All identifiers validated and normalized
- Limits on joins/filters/rows to prevent abuse
- All realtime and view results respect row policies
- Secrets never returned after creation (API keys, signing secrets)
