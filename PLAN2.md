# PLAN — No-Code BaaS with Real SQL Tables (FastAPI + Postgres + TanStack + shadcn)

This plan assumes the MVP from the previous PLAN is already implemented:
- Auth (JWT + refresh rotation), Projects/Memberships, API Keys
- Docker Compose + migrations + basic UI

**New direction:** the platform is **no-code**. End users configure schemas, rules, and workflows from the UI. The platform generates/maintains **real PostgreSQL tables** (no JSONB storage for user data).

---

## 0) Product goals and non-goals

### Goals (what makes it “no-code”)
- Users can create **Collections** (tables) and **Fields** (columns) from the UI
- Platform applies safe **DDL** to Postgres
- Platform exposes **generated CRUD APIs** per project/collection
- Platform enforces **no-code permissions and row rules**
- Platform provides **audit + schema change logs**
- Platform remains safe: no arbitrary SQL input, no direct DB access for end users

### Non-goals (explicitly deferred)
- Arbitrary SQL queries by users
- Auto “perfect” migrations (drop columns/type changes) early on
- Complex multi-tenant joins across projects
- Full BI/query builder in v1

---

## 1) Core architecture decisions (locked for v1)

### 1.1 Multi-tenancy strategy
**Recommended:** Postgres **schema-per-project** (strong isolation, simple table naming).
- Each project has a dedicated schema: `p_<project_id>` (or `prj_<id>`)
- All collections (tables) live inside that schema
- Platform metadata lives in a shared `public` schema (platform tables)

If you already use “project_id column everywhere”, you can still migrate later—but schema-per-project is the cleanest for a no-code table builder.

### 1.2 How “no-code schema” maps to SQL
- A no-code **Collection** → a SQL table in the project schema
- A no-code **Field** → a column in that table
- No-code **Indexes/Constraints** → SQL indexes/constraints
- No-code **Relations** (v2) → foreign keys (with strict controls)

### 1.3 DDL safety policy (important)
In v1, only support safe operations:
- ✅ Create table
- ✅ Add column
- ✅ Add index / unique constraint
- ✅ Add NOT NULL only if a default is provided (or column is nullable first then backfill)
- ⛔ Drop column (defer)
- ⛔ Change column type (defer)
- ⛔ Rename column/table (optional later; can be risky with clients)

Reason: these operations are the main source of outages and data loss.

---

## 2) Platform “Catalog” (metadata) — required even with real tables

Create platform tables that describe user-configured schemas.

### 2.1 Catalog tables (public schema)
- `collections`
  - `id`, `project_id`, `name` (slug), `display_name`, `sql_table_name`
  - `is_active`, `created_at`, `updated_at`
- `fields`
  - `id`, `collection_id`, `name` (slug), `display_name`
  - `type` (enum), `is_required`, `is_unique`, `default_value` (optional)
  - `sql_column_name`, `created_at`, `updated_at`
- `indexes`
  - `id`, `collection_id`, `name`, `is_unique`, `fields[]` (ordered)
- `schema_ops`
  - append-only log of every schema change applied
  - `id`, `project_id`, `collection_id`, `op_type`, `payload_json`, `status`, `error`, `created_at`, `actor_user_id`
- Optional but recommended:
  - `audit_events` (all API changes, not only schema)

### 2.2 Naming rules (strict)
- Collection/field “slugs” must match: `^[a-z][a-z0-9_]{0,62}$`
- Disallow reserved keywords and dangerous names (`select`, `drop`, etc.)
- Enforce uniqueness per project/collection

**Never** allow users to supply raw SQL identifiers.

---

## 3) Milestones (execution order)

## Milestone A — Project schema bootstrap
**Goal:** every project has a dedicated DB schema and a safe lifecycle.

Tasks:
A1. Create “project schema ensure” logic:
- On project creation: create schema `p_<project_id>`
- On request: lazily ensure schema exists (idempotent)

A2. Add schema deletion policy (deferred execution):
- Never drop automatically; allow admin-only “decommission” with confirmations

Acceptance criteria:
- New project reliably creates schema
- Permissions and migrations do not break on fresh DB

---

## Milestone B — No-code Collections (DDL: CREATE TABLE)
**Goal:** create a collection from the UI and materialize it as a real table.

Tasks:
B1. Catalog CRUD for collections:
- Create/list/get/update (display_name, active)
B2. DDL engine v1: `CREATE TABLE`
- Always include platform columns:
  - `id BIGSERIAL PRIMARY KEY`
  - `created_at timestamptz NOT NULL default now()`
  - `updated_at timestamptz NOT NULL default now()`
  - `created_by_user_id bigint NULL` (optional but recommended for row rules)
B3. Record operation in `schema_ops`

Endpoints (suggested):
- `POST /api/projects/{project_id}/schema/collections`
- `GET  /api/projects/{project_id}/schema/collections`
- `GET  /api/projects/{project_id}/schema/collections/{collection}`

Acceptance criteria:
- Creating a collection creates:
  - catalog row + SQL table in `p_<project_id>`
  - `schema_ops` entry with status=applied
- Duplicate names are rejected

---

## Milestone C — No-code Fields (DDL: ALTER TABLE ADD COLUMN)
**Goal:** add fields safely and enforce column constraints.

Tasks:
C1. Supported field types (v1):
- `string` → `text`
- `int` → `bigint`
- `float` → `double precision`
- `bool` → `boolean`
- `date` → `date`
- `datetime` → `timestamptz`
- `uuid` → `uuid`
- `enum` (v1 optional) → `text` + check constraint (or separate enum type later)

C2. DDL engine v1: `ALTER TABLE ADD COLUMN`
Rules:
- If `is_required=true` then either:
  - require a default, or
  - add as nullable, backfill, then set NOT NULL (automated migration step)
- If `is_unique=true` create unique index/constraint
- Add normal index if user requests “indexed”

Endpoints:
- `POST /api/projects/{project_id}/schema/collections/{collection}/fields`
- `GET  /api/projects/{project_id}/schema/collections/{collection}/fields`

Acceptance criteria:
- Adding a field updates:
  - catalog + real SQL column
  - constraints/indexes if requested
  - schema_ops record
- Invalid operations fail without partial state (transactional where possible)

---

## Milestone D — Generated CRUD API (real SQL tables)
**Goal:** one generic CRUD layer works for all user-created collections.

Design:
- Resolve `{project_id, collection}` → physical table `p_<project_id>.<table>`
- Validate payloads using catalog (required fields, types, uniqueness hints)
- Execute SQL safely (parameterized queries only)
- Pagination, filtering, sorting (v1 simple)

Endpoints (suggested):
- `POST   /api/projects/{project_id}/data/{collection}`
- `GET    /api/projects/{project_id}/data/{collection}`
- `GET    /api/projects/{project_id}/data/{collection}/{id}`
- `PATCH  /api/projects/{project_id}/data/{collection}/{id}`
- `DELETE /api/projects/{project_id}/data/{collection}/{id}`

Filtering/sorting/pagination (v1):
- `?limit=50&cursor=<id>`
- `?sort=created_at:desc`
- `?filter[field]=value` (only equality at first)
- Expand later to operators (`gt/lt/contains`)

Acceptance criteria:
- CRUD works for any created collection
- Strong validation: unknown fields rejected, wrong types rejected
- No SQL injection surface (no raw SQL from user input)

---

## Milestone E — No-code Permissions + Row Rules
**Goal:** configure access control from UI and enforce it at runtime.

E1. Collection-level permissions (v1):
- Who can read/write/delete:
  - `owner/admin/member`
  - `api_key`
  - optional: `public_read` (off by default)

E2. Row-level rules (v1 minimal but useful):
- “Only rows where `created_by_user_id = current_user.id`”
- “Only allow update/delete if created_by matches”
- “API key mode” optionally bypasses user-based row rules (configurable)

Catalog tables:
- `collection_policies` (per collection: read/write/delete scopes)
- `row_policies` (simple policy type + params)

Acceptance criteria:
- Policies are editable from UI
- Backend enforces policies consistently on every CRUD call
- Tests cover: allowed vs forbidden for at least 3 roles

---

## Milestone F — Admin Console UX (No-code builder UI)
**Goal:** users can do everything from the UI (no-code).

Pages:
- Collections list + create
- Collection detail:
  - Fields list + add field form
  - Indexes/constraints (optional v1)
  - Policies (read/write/delete + row rule toggle)
- Data explorer:
  - table view with pagination + filters
  - create/edit forms generated from field metadata
- API Keys page (already exists) + show how to call generated CRUD

Acceptance criteria:
- A non-technical user can:
  1) create a collection
  2) add fields
  3) insert a record
  4) restrict access to “owner only”
  5) create an API key and fetch data with it

---

## Milestone G — Audit + Schema Change Logs
**Goal:** platform is observable and safe to operate.

G1. Schema ops log:
- every DDL operation recorded with actor and payload

G2. Audit events:
- record every mutating request:
  - who/what (user vs api key)
  - project
  - action
  - resource
  - status

UI:
- “Logs” page with filters (project, actor, action, date range)

Acceptance criteria:
- You can answer: “who changed schema X and when?”
- You can trace data changes for a record

---

## Milestone H — Background jobs + Webhooks (No-code workflows foundation)
**Goal:** enable automation without code.

H1. Job queue (choose one):
- Celery/RQ/Arq (keep it simple)
H2. Event bus:
- CRUD and schema operations emit events
H3. Webhooks:
- projects can register endpoints for events
- signing secret + retries

Acceptance criteria:
- On record created, webhook is delivered (with retries logged)
- Workflow foundation exists for next milestone

---

## Milestone I — No-code Workflows (Triggers → Actions)
**Goal:** the “Zapier inside your BaaS”.

I1. Workflow builder UI:
- Trigger: record created/updated/deleted, schedule, webhook received
- Actions: HTTP request, create/update record, delay, condition

I2. Execution engine:
- persist runs, steps, outputs
- retry strategy

Acceptance criteria:
- User can create: “When order created → call external endpoint → write response into another table”

---

## 4) Hard requirements (engineering guardrails)

### 4.1 Concurrency and locking
- Use DB transactions for catalog + DDL coordination
- For DDL: use an application-level lock per `{project_id}` or `{collection_id}`
  (e.g., Postgres advisory locks) to avoid overlapping schema changes.

### 4.2 Backwards compatibility
- Generated CRUD endpoints must not break when schema changes
- Prefer additive changes only in v1 (create/add column/index)

### 4.3 Performance basics
- Cache catalog metadata per project (with invalidation on schema_ops)
- Ensure indexes on:
  - `users.email`
  - `refresh_tokens.token_hash`
  - `api_keys.key_hash`, `api_keys.prefix`
  - catalog lookup keys (`collections.project_id,name`, `fields.collection_id,name`)

### 4.4 Testing strategy
Minimum tests per milestone:
- Schema creation creates table in correct schema
- Add field results in column existence + constraints
- CRUD insert/read/update/delete works
- Policies forbid/allow correctly
- Schema_ops/audit_events created

---

## 5) Deliverables checklist (Definition of Done)
A milestone is done only when:
- Migrations exist and apply on a fresh DB
- Endpoints documented in OpenAPI
- UI flow works end-to-end
- Tests cover happy path + at least one failure path
- Schema_ops and audit logs capture the action

---

## 6) Suggested milestone order (recommended)
1) A: Project schema bootstrap
2) B: Collections (CREATE TABLE)
3) C: Fields (ADD COLUMN + constraints)
4) D: Generated CRUD
5) E: Policies (no-code permissions + row rules)
6) F: Builder UI + Data explorer
7) G: Logs (audit + schema ops)
8) H: Jobs + Webhooks
9) I: Workflows

This sequence builds a true no-code BaaS without compromising safety.
