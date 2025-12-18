# AGENTS

This repo is a personal "Backend as a Service" (BaaS) starter built with:
- Backend: FastAPI + SQLAlchemy + Alembic + Postgres
- Frontend: Vite React + TanStack Router + TanStack Query + shadcn/ui + Tailwind
- Infra: Docker + Docker Compose

The goal is an MVP that is production-shaped: clean architecture, secure auth, multi-tenancy, API keys, migrations, tests, and good DX.

## How Codex CLI should work in this repo

### Global rules
- Prefer small, reviewable PR-style changes (one feature per commit group).
- Keep the code boring and explicit; avoid clever abstractions early.
- No “TODO: later” in critical paths (auth, security, migrations).
- Every new DB model change must include an Alembic migration.
- Every new endpoint must include:
  - request/response schemas
  - error handling
  - basic tests (happy path + one failure)

### Repository structure
- `backend/app/`: FastAPI app code
- `backend/alembic/`: migrations
- `frontend/src/`: React app
- `docker-compose.yml`: local dev orchestration
- `.env.example`: env reference (never commit secrets)

### Definition of Done (DoD)
A task is done only if:
- Code compiles/lints (as applicable)
- Tests added/updated and passing
- OpenAPI docs render without runtime errors
- Migrations run cleanly on a fresh DB
- Minimal README snippet updated if developer workflow changes

---

## Agent roles (use these as “hats”)

### 1) Tech Lead Agent
Responsibilities:
- Keep architecture coherent (folders, boundaries, naming).
- Decide patterns: sync vs async SQLAlchemy, error model, auth flow.
- Maintain consistent API conventions (status codes, pagination, envelopes).

Output expectations:
- High-level decisions recorded in `PLAN.md` or `README.md`
- Clear acceptance criteria per milestone

### 2) Backend Agent (FastAPI)
Responsibilities:
- Implement domain models, services, and API routers.
- Ensure secure auth:
  - bcrypt password hashing
  - JWT access token
  - refresh token rotation (opaque tokens stored hashed)
  - API keys stored hashed and shown once
- Add tests (pytest) and seed/dev utilities.

Constraints:
- Use SQLAlchemy 2.x patterns.
- All DB changes via Alembic migrations.
- Avoid returning sensitive fields ever (hashes, secrets).

### 3) Frontend Agent (TanStack + shadcn)
Responsibilities:
- Implement auth flows (login/register/refresh).
- Implement app layout and core pages:
  - Dashboard
  - Projects
  - API Keys
- TanStack Query for server state; Router for navigation.
- Build small UI primitives if shadcn generator isn’t available.

Constraints:
- Keep UI minimal but clean.
- Centralize API client with token handling (attach bearer, refresh on 401).

### 4) DevOps Agent (Docker/Compose)
Responsibilities:
- Maintain Dockerfiles and docker-compose dev ergonomics.
- Ensure “one command” dev startup:
  - `docker compose up --build`
- Add healthchecks where useful.
- Ensure environment variables are consistent across services.

### 5) QA/Testing Agent
Responsibilities:
- Add integration tests for auth + tenancy.
- Add basic frontend checks (at least smoke test / typecheck).
- Verify migrations + startup on a fresh environment.

---

## Coding standards (must follow)

### Backend
- Pydantic v2 schemas in `app/schemas/`
- Business logic in `app/services/`
- Routers in `app/api/routes/`
- Dependencies in `app/api/deps.py`
- Never import DB session globally; use `Depends(get_db)`
- Return consistent error shapes (FastAPI default is OK for MVP)

### Frontend
- `src/lib/api.ts` for API client
- `src/lib/auth.ts` for token storage + refresh helper
- Query keys must be stable and centralized
- Avoid prop drilling: prefer hooks and route loaders where appropriate

---

## Security checklist (minimum MVP)
- Passwords: bcrypt
- JWT secret must come from env; do not hardcode
- Refresh tokens: opaque, hashed in DB, rotated on refresh
- API keys: opaque, hashed in DB, scoped to project, revocable
- CORS restricted to configured origins
- Rate limiting optional for MVP, but keep a spot for it

---

## How to prioritize work
- Make backend auth + tenancy solid first.
- Then build frontend pages.
- Then add “BaaS extras” (audit logs, webhooks, storage, realtime).
