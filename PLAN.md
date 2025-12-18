# PLAN — Personal BaaS (FastAPI + TanStack + shadcn + Postgres + Docker)

This plan is written to be executed by Codex CLI in small, safe increments.

## 0) Target MVP Scope (what “done” means)

### MVP features
1) Auth
- Register (email + password)
- Login (email + password)
- JWT access token (short TTL)
- Refresh token (opaque, stored hashed, rotation on refresh)
- Logout (revoke refresh token)

2) Multi-tenancy
- Projects (tenants)
- Memberships (user ↔ project) with role: `owner` (MVP), later `admin`, `member`

3) API Keys (server-to-server)
- Create API key per project (show plaintext once)
- List API keys (never show plaintext)
- Revoke API key

4) Frontend Admin UI
- Auth pages (login/register)
- Dashboard (list projects)
- Project details page (list/create/revoke API keys)

5) DX & Quality
- Docker Compose dev environment
- Alembic migrations
- Backend tests for auth + tenancy basics

---

## 1) Architecture decisions (locked for MVP)

### Backend
- FastAPI + SQLAlchemy 2.x (sync) + Alembic
- Postgres 16 (docker)
- Password hashing: passlib bcrypt
- JWT: python-jose
- Refresh token strategy:
  - generate opaque token
  - store `sha256(token)` in DB
  - rotate on refresh (revoke old, mint new)
- API key strategy:
  - opaque token
  - store hash
  - include a prefix column to help identify keys without leaking secrets

### Frontend
- Vite React TS
- TanStack Router + Query
- Tailwind + shadcn/ui style components (minimal set is OK)

### Infra
- `docker compose up --build` brings everything up
- backend runs `alembic upgrade head` on startup (dev only)

---

## 2) Work breakdown (milestones)

### Milestone A — Backend foundation
**Goal:** app boots, connects to DB, migrations work.

Tasks:
A1. Create backend skeleton structure:
- `app/main.py`, `app/core/config.py`, `app/db/*`, `app/api/router.py`
Acceptance:
- `GET /health` returns `{ ok: true }`
- App starts with `uvicorn app.main:app`

A2. DB session + Base model
Acceptance:
- backend can open a session and run a trivial query (in a test or startup check)

A3. Alembic setup + initial migration
- models: `User`, `Project`, `Membership`, `RefreshToken`, `ApiKey`
Acceptance:
- `alembic revision --autogenerate` produces migration
- `alembic upgrade head` works on a fresh DB

---

### Milestone B — Auth (register/login/refresh/logout)
**Goal:** secure auth flows with refresh rotation.

Tasks:
B1. Implement auth schemas:
- RegisterIn, LoginIn, TokenPair, RefreshIn
B2. Implement auth service:
- register_user()
- login_user()
- issue_tokens()
- refresh_tokens() rotation
- logout_refresh_token()
B3. Implement auth routes:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
B4. Implement `GET /api/me`
Acceptance:
- Register creates user
- Login returns access+refresh
- Refresh rotates refresh token (old becomes invalid)
- Logout revokes refresh
- `/api/me` returns current user with Bearer token

Security acceptance:
- Never return password_hash
- Refresh token stored hashed
- Proper status codes:
  - 400/409 for conflicts
  - 401 for invalid credentials/token

---

### Milestone C — Projects & memberships
**Goal:** user can create and list their projects.

Tasks:
C1. Project schemas: create + out
C2. Project service:
- create_project(owner, name) -> creates membership owner
- list_projects_for_user(user)
- get_project_for_user(user, project_id)
C3. Project routes:
- `POST /api/projects` (auth required)
- `GET /api/projects` (auth required)
- `GET /api/projects/{id}` (auth required; only members)
Acceptance:
- Creating project also creates membership role=owner
- Listing returns only user’s projects
- Access to non-member project returns 404 (or 403; choose 404 for less leakage)

---

### Milestone D — API Keys per project
**Goal:** create/list/revoke API keys and validate them.

Tasks:
D1. API key schemas:
- ApiKeyCreate, ApiKeyOut, ApiKeyCreated
D2. API key service:
- create_api_key(project, name) returns (db_row, plaintext_key_once)
- list_api_keys(project)
- revoke_api_key(project, api_key_id)
D3. Routes:
- `POST /api/projects/{id}/api-keys`
- `GET /api/projects/{id}/api-keys`
- `POST /api/projects/{id}/api-keys/{api_key_id}/revoke`
D4. Auth dependency:
- Support either Bearer JWT OR `X-API-Key` header (for later “BaaS API” calls)
Acceptance:
- Plaintext API key returned only on creation
- Listing never returns plaintext
- Revoke makes key unusable
- Hash comparison used (sha256)

---

### Milestone E — Backend tests
**Goal:** confidence in core flows.

Tasks:
E1. Add pytest + test DB strategy
- Prefer ephemeral Postgres in docker (or sqlite for unit tests if kept simple)
E2. Tests:
- register/login happy path
- refresh rotation invalidates old refresh token
- create/list project
- create/list/revoke api key
Acceptance:
- `pytest` passes
- tests are deterministic

---

### Milestone F — Frontend foundation
**Goal:** app boots and can call backend.

Tasks:
F1. Setup Vite React TS + Tailwind
F2. Add TanStack Router + Query
F3. Create API client:
- base URL from `VITE_API_URL`
- attach bearer token
- refresh flow on 401 (single-flight refresh)
F4. Basic layout:
- nav sidebar/topbar
Acceptance:
- frontend runs on `:5173`
- can hit `/health` and show status

---

### Milestone G — Frontend auth pages
**Goal:** login/register + session persistence.

Tasks:
G1. `/login` page
G2. `/register` page
G3. token storage strategy:
- store refresh token securely (MVP: localStorage acceptable for personal project; document risk)
- store access token in memory/localStorage (choose one and document)
G4. protected routes + redirect to login
Acceptance:
- user can register -> login -> access dashboard
- refresh happens when access token expires (or on 401)

---

### Milestone H — Projects UI + API Keys UI
**Goal:** manage projects and keys in UI.

Tasks:
H1. Dashboard: list projects
H2. Create project modal/form
H3. Project detail page:
- list API keys
- create API key (show plaintext once; prompt user to copy)
- revoke API key action
Acceptance:
- all operations succeed end-to-end via backend API
- UI handles errors clearly

---

## 3) API Contract (MVP)

### Auth
- `POST /api/auth/register` {email, password} -> {id, email} OR token pair (choose: keep simple: return token pair)
- `POST /api/auth/login` {email, password} -> {access_token, refresh_token}
- `POST /api/auth/refresh` {refresh_token} -> {access_token, refresh_token}
- `POST /api/auth/logout` {refresh_token} -> 204
- `GET /api/me` -> {id, email}

### Projects
- `POST /api/projects` {name} -> {id, name}
- `GET /api/projects` -> [{id, name}]
- `GET /api/projects/{id}` -> {id, name}

### API Keys
- `POST /api/projects/{id}/api-keys` {name} -> {id, name, prefix, api_key}
- `GET /api/projects/{id}/api-keys` -> [{id, name, prefix, revoked}]
- `POST /api/projects/{id}/api-keys/{api_key_id}/revoke` -> 204

---

## 4) Non-goals for MVP (explicitly deferred)
- Full RBAC matrix, invites, email verification
- Password reset emails
- Rate limiting
- Audit log UI
- File storage
- Realtime updates
These can be Milestone I+ later.

---

## 5) Implementation notes (important details)

### Token handling
- Access token: JWT, short TTL, includes `sub=user_id`
- Refresh token:
  - store hashed in DB + expires_at
  - on refresh:
    - validate token hash exists, not revoked, not expired
    - revoke old token
    - mint and store new refresh token
    - return new pair

### API key handling
- store sha256 hash
- also store prefix = first 8 chars of plaintext key
- return plaintext key only once on creation

### Status codes
- register conflict: 409
- login invalid: 401
- forbidden membership: 404 (to avoid leaking existence)
- revoke: 204

---

## 6) Dev workflow
- `docker compose up --build`
- backend OpenAPI: `/docs`
- keep `.env.example` updated

---

## 7) Checklists per milestone (for Codex)

### Backend milestone checklist
- [ ] App boots via docker compose
- [ ] Alembic migration exists and applies
- [ ] Auth endpoints work
- [ ] Project endpoints work
- [ ] API key endpoints work
- [ ] Tests pass

### Frontend milestone checklist
- [ ] Login/register flows work
- [ ] Token refresh works
- [ ] Projects list/create works
- [ ] API keys list/create/revoke works

---

## 8) Suggested next enhancements (after MVP)
- Add `AuditEvent` table and middleware to record actions
- Add `Webhooks` + event deliveries
- Add `Collections` concept (generic CRUD per project)
- Add rate limiting
- Add admin role + invite flow
