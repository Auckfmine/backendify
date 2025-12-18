# PLAN — BaaS Authentication & Authorization (Project App Users) — Full Feature

This plan adds **App User Authentication** to your no-code BaaS so your customers can use it in their frontends.
It is **separate** from your existing **Admin/Console auth** (project owners managing schema/views/policies).

You already have:
- Admin auth (JWT + refresh rotation) for the console
- Projects / memberships / API keys
- Collections + Views (real SQL tables) + policies + row rules
- Audit logs + schema ops
- Jobs + webhooks + workflows foundation

Goal:
- Provide **Auth solutions** (email/password, OTP/magic link, OAuth) that projects can enable via UI
- Provide **frontend-ready endpoints** (register/login/refresh/me/logout)
- Ensure **Collections/Views endpoints are enforced** based on the selected auth method + your no-code policies

---

## 0) Terminology (avoid confusion)

### Admin Users
- People who use your console (project admins).
- Auth already exists and should remain unchanged.

### App Users
- End users of your customer’s app (the people who sign up/sign in from a frontend).
- This PLAN introduces these identities.

### Principals (Auth Context)
Every request resolves to exactly one principal:
- `admin_user` (console JWT)
- `app_user` (project-scoped JWT)
- `api_key` (server-to-server)
- `anonymous` (public access if configured)

---

## 1) Requirements (must-haves)

### Functional
1) Project-scoped app auth endpoints:
- register/login/refresh/logout/me
2) Projects can choose/enable auth methods from UI:
- Email+password (v1)
- Magic link / OTP (v1.1)
- OAuth (Google, GitHub) (v1.2)
3) Generated endpoints (Collections + Views) enforce access based on:
- principal type (app_user/api_key/anonymous)
- collection/view policies (no-code)
- row rules (no-code)
4) Multi-tenant isolation: app users belong to exactly one project.
5) Secure sessions:
- short-lived access token (JWT)
- refresh tokens are opaque, stored hashed, rotated
6) Full audit logging for auth events:
- register, login, logout, refresh, password change, otp send, oauth link
7) Postman-friendly + frontend-friendly:
- clear error codes, stable contracts, `/meta` doc endpoint for auth too

### Non-functional
- Security best practices (password hashing, rate limiting, lockout)
- Backward compatibility with existing admin auth
- Test coverage (unit + integration)
- DX: simple usage examples and docs in UI

---

## 2) Architecture decisions (locked)

### 2.1 Project-scoped App User auth
- App users are stored in platform tables with `project_id`.
- Access tokens include `project_id` claim and `sub=app_user_id`.

### 2.2 Token model
- Access token: JWT signed by server secret (or per-project signing key).
- Refresh token: opaque string; store `sha256(token)` in DB.
- Rotation on refresh: revoke old token, mint new.

### 2.3 Cookie vs Header
Support BOTH:
- `Authorization: Bearer <access>` (easy for Postman/mobile)
- Optional cookie mode:
  - refresh token stored in httpOnly secure cookie
  - access returned in body or set as cookie (choose one)
Start with header-based tokens; add cookie mode as project setting.

### 2.4 Policy enforcement
- Collection/View policy must support:
  - allow: `app_user`, `api_key`, `anonymous`
  - optionally require verified email or roles
- Row rules can reference:
  - `principal.app_user_id`
  - `principal.email`
  - `record.created_by_app_user_id`

---

## 3) Data model (DB tables)

> Names are suggestions; keep consistent with your codebase.

### 3.1 App users
`app_users`
- `id` (bigserial)
- `project_id` (fk -> projects)
- `email` (citext or lowercased text)
- `password_hash` (nullable if oauth-only)
- `is_email_verified` (bool default false)
- `is_disabled` (bool default false)
- `created_at`, `updated_at`
Indexes:
- unique `(project_id, email)`

### 3.2 App refresh tokens (sessions)
`app_refresh_tokens`
- `id`
- `project_id`
- `app_user_id`
- `token_hash` (unique)
- `revoked` (bool)
- `expires_at`
- `created_at`
- `last_used_at` (optional)
- `ip` / `user_agent` (optional but useful)

### 3.3 Auth settings per project
`project_auth_settings`
- `project_id` (pk)
- `enable_email_password` (bool)
- `enable_magic_link` (bool)
- `enable_otp` (bool)
- `enable_oauth_google` (bool)
- `enable_oauth_github` (bool)
- `access_ttl_minutes`
- `refresh_ttl_days`
- `session_mode` enum: `header` | `cookie`
- `allow_public_views` (bool) (optional)
- `password_policy_json` (optional)
- `created_at`, `updated_at`

### 3.4 OTP / Magic link
`app_otp_codes`
- `id`
- `project_id`
- `email`
- `code_hash`
- `purpose` enum: `login` | `verify_email` | `reset_password`
- `expires_at`
- `attempts` (int)
- `created_at`
Indexes:
- `(project_id, email, purpose)`

### 3.5 OAuth identities
`app_identities`
- `id`
- `project_id`
- `app_user_id`
- `provider` enum: `google`, `github`
- `provider_user_id` (string)
- `email` (optional)
- `created_at`
Unique:
- `(project_id, provider, provider_user_id)`

### 3.6 Email verification / password reset tokens (optional)
`app_email_tokens`
- `id`
- `project_id`
- `app_user_id`
- `token_hash`
- `purpose` enum: `verify_email`, `reset_password`
- `expires_at`
- `used_at` nullable
- `created_at`

---

## 4) API design (endpoints)

All App User endpoints are **project-scoped**:

### 4.1 Discovery / config
- `GET /api/projects/{project_id}/auth/providers`
Returns enabled providers and session mode.

### 4.2 Email + password (v1)
- `POST /api/projects/{project_id}/auth/register`
  - body: `{ email, password }`
  - returns: `{ access_token, refresh_token, token_type }` OR `{ user, ... }`
- `POST /api/projects/{project_id}/auth/login`
  - body: `{ email, password }`
  - returns tokens
- `POST /api/projects/{project_id}/auth/refresh`
  - body: `{ refresh_token }` (or cookie)
  - returns new tokens (rotated refresh)
- `POST /api/projects/{project_id}/auth/logout`
  - body: `{ refresh_token }` (or cookie)
  - returns `204`
- `GET /api/projects/{project_id}/auth/me`
  - auth: app_user access token
  - returns `{ id, email, is_email_verified }`

### 4.3 Email verification (v1.1)
- `POST /api/projects/{project_id}/auth/verify/send`
- `POST /api/projects/{project_id}/auth/verify/confirm`
  - confirm by code or token

### 4.4 Password reset (v1.1)
- `POST /api/projects/{project_id}/auth/password/reset/send`
- `POST /api/projects/{project_id}/auth/password/reset/confirm`
- `POST /api/projects/{project_id}/auth/password/change` (requires logged-in)

### 4.5 OTP / Magic link login (v1.1)
- `POST /api/projects/{project_id}/auth/otp/send`
  - `{ email, purpose: "login" }`
- `POST /api/projects/{project_id}/auth/otp/verify`
  - `{ email, code }` → tokens

Magic link is the same concept but code delivered as tokenized link.

### 4.6 OAuth (v1.2)
- `GET /api/projects/{project_id}/auth/oauth/{provider}/start`
- `GET /api/projects/{project_id}/auth/oauth/{provider}/callback`
- Optional:
  - `POST /api/projects/{project_id}/auth/oauth/{provider}/link`
  - `POST /api/projects/{project_id}/auth/oauth/{provider}/unlink`

### 4.7 Admin UI endpoints (project owner)
- `GET/PUT /api/projects/{project_id}/settings/auth`
  - enable/disable methods, ttl, cookie/header mode, password policy

---

## 5) Enforcement on Collections and Views

### 5.1 Principal resolution (middleware/deps)
Create a unified resolver:
- If `Authorization: Bearer ...`:
  - detect whether token is `admin_user` vs `app_user` (different issuer/claims or token type)
- Else if `X-API-Key`:
  - principal = api_key (project-scoped)
- Else:
  - principal = anonymous

### 5.2 Policy model updates
Extend your policy system so each Collection/View has:
- allowed_principals: `["app_user", "api_key"]` (and optionally `anonymous`)
- optional rules:
  - `require_email_verified`
  - `require_role` (future)

### 5.3 Row rules for app users
Add system columns in data tables (recommended):
- `created_by_app_user_id bigint NULL`
- `updated_by_app_user_id bigint NULL`

On write:
- if principal is app_user, auto-set these columns.
Row policies can then do:
- `created_by_app_user_id == principal.app_user_id`

### 5.4 Public access rules (careful)
Allow `anonymous` only if explicitly enabled, and typically only for Views.
- Default: anonymous disabled.

---

## 6) Security hardening (must implement)

### 6.1 Password policy
- min length, complexity optional
- breached password check optional
- store bcrypt hash
- never log passwords

### 6.2 Rate limiting
- `/auth/login` and `/auth/register` per IP + per email
- `/auth/otp/send` strict per email
- `/auth/refresh` moderate limit

### 6.3 Lockout / throttling
- after N failed logins for (project_id,email): temporary lock

### 6.4 Session hygiene
- refresh token rotation
- revoke refresh token on logout
- optional “revoke all sessions” endpoint

### 6.5 Email enumeration protection
- For “send reset/otp”, respond success even if email not found (configurable)

---

## 7) “Auth Usage Meta” (self-documenting, like Views L5)

Add:
- `GET /api/projects/{project_id}/auth/meta`

Return:
- enabled providers
- endpoint list + payload schemas
- examples (curl/fetch/postman)
- token handling instructions (cookie/header)
- error codes and meanings

This is critical for no-code users to integrate quickly.

---

## 8) Frontend (Console UI) requirements

### 8.1 Auth Settings page (Project)
- toggle providers
- set TTLs
- choose session mode (header/cookie)
- configure public access rules (if allowed)

### 8.2 App Users management (optional but valuable)
- list app users
- disable/enable user
- revoke sessions
- impersonation (admin-only, optional, sensitive)

### 8.3 Developer / Integration tab
- shows `/auth/meta`
- copy-paste snippets
- Postman export button

---

## 9) Testing plan (must be comprehensive)

### 9.1 Backend tests (minimum)
Email+password:
- register → login → me
- refresh rotates token; old refresh rejected
- logout revokes refresh
- policy enforcement:
  - collection requires app_user → anonymous rejected
  - view is public → anonymous allowed
Row rules:
- app_user can only see own records (created_by_app_user_id)
- api_key bypass or obey rules based on setting

OTP/magic link:
- send code → verify → tokens
- expired code rejected
- attempt limit enforced

OAuth:
- start → callback creates/links identity
- login returns tokens

Rate limiting:
- repeated login attempts produce 429
- otp send spam blocked

### 9.2 Integration tests (recommended)
- run against real Postgres
- ensure multi-project isolation: same email in different projects is allowed

### 9.3 Frontend tests (optional)
- smoke test settings page
- copy snippet rendering

---

## 10) Milestones & delivery sequence

### Milestone A — Foundations (App Users + Email/Password)
1) Add DB tables: `app_users`, `app_refresh_tokens`, `project_auth_settings`
2) Implement auth settings endpoints (admin-only)
3) Implement app auth endpoints:
   - register/login/refresh/logout/me
4) Implement principal resolver and enforce policies on data/view endpoints
5) Add `/auth/meta` endpoint
6) Add audit events for auth actions

Acceptance:
- A project can enable email/password
- Frontend can authenticate an app user and access protected collection/view routes
- Postman can test all flows

### Milestone B — Email verification + password reset
Acceptance:
- verify email flow works
- password reset works
- optional “require verified email” policy works

### Milestone C — OTP/Magic link login
Acceptance:
- OTP login works safely with throttling and expiration

### Milestone D — OAuth (Google/GitHub)
Acceptance:
- OAuth login works per project, creates app user if needed, links identity

### Milestone E — Security & Ops polish
- rate limiting everywhere appropriate
- session revocation tools
- logs/metrics dashboards for auth

---

## 11) Definition of Done (global)
This plan is complete when:
- App user auth is configurable per project in UI
- Auth endpoints are documented via `/auth/meta` and surfaced in “Developer” UI
- Collections/Views enforce access based on principal + no-code policies
- Row rules can be expressed using app user identity
- Full test suite passes (unit + integration)
- Audit logs cover auth lifecycle events
