# Tabular Review — Monorepo Guide

AI document-review workspace: ingest unstructured documents (contracts, etc.),
extract structured data into a spreadsheet-style grid via an on-prem LLM, verify
each cell against its source citation, and query the dataset via chat.

This file orients you across the repo. Each app has its own `CLAUDE.md` with the
detail that matters when working inside it — **read the relevant one before
editing that app.**

## Source of truth

[docs/domain-design.md](docs/domain-design.md) is the **single source of truth**
for the domain model, database tables, and API contract (entities, bounded
contexts, ERD, Postgres+pgvector DDL, REST endpoints, retrieval pipeline). When
implementing or changing anything in that space, **align to that document — and
when reality diverges, update the document in the same change.** Treat it as a
living spec, not a snapshot. (UI/UX spec lives in `docs/screen-plan.md`.)

## Layout

```
.
├── frontend/      Next.js App Router + Feature-Sliced Design (FSD). See frontend/CLAUDE.md
├── backend/       FastAPI + DDD (bounded contexts, ports & adapters). See backend/CLAUDE.md
├── docs/          domain-design.md = 도메인/테이블/API 진실원천; screen-plan.md = UI/UX 화면기획
├── docker-compose.yml   Runs both services
├── .env.example         Compose-level env (copy to .env)
└── start-backend.sh     Local backend dev (venv + uvicorn, MPS on macOS)
```

The previous single-folder Vite SPA + `server/` layout was split into
`frontend/` and `backend/` and re-architected (Next.js/FSD and FastAPI/DDD).

## How the two apps relate

```
Browser ─▶ frontend (Next.js, :3000 / :13001)
                │  fetch
                ▼
           backend (FastAPI, :8000 / :18001)
                ├─ POST /convert                 Docling: PDF/DOCX → Markdown
                └─ POST /llm/chat/completions     proxy → on-prem vLLM (OpenAI-compatible)
```

- The frontend never talks to vLLM directly — it goes through the backend proxy
  (keeps the API key server-side, avoids browser CORS).
- Document text is converted to Markdown by the backend, then stored base64 in
  the frontend and sent (per cell) to the LLM for extraction.
- API contract today is informal (OpenAI chat-completions shape + a `/convert`
  Markdown response). When formalizing, define the schema in the backend and
  mirror it as Zod in the frontend (see frontend/CLAUDE.md).

## Running

```bash
# Both services
cp .env.example .env        # then edit VLLM_BASE_URL etc.
docker compose up --build

# Local dev (separate terminals)
./start-backend.sh                      # backend on :8000
cd frontend && pnpm install && pnpm dev # frontend on :3000
```

Ports: backend `18001:8000`, frontend `13001:3000` (compose).

## Conventions

- **Frontend**: Next.js App Router, FSD layers, pnpm, Biome, TanStack Query,
  Zustand, Zod. Strict FSD import rules enforced by `frontend/scripts/check-fsd-imports.mjs`.
- **Backend**: DDD with bounded contexts under `app/domains/<context>/` split
  into `domain / application / infrastructure / interface`. Dependency inversion
  via ports (ABCs); composition happens only in `app/main.py`.
- The `.claude/skills/` personas (frontend-engineer, react-best-practices,
  product-qa) encode the intended engineering standards — consult them when
  building features.

## Product direction

See [docs/screen-plan.md](docs/screen-plan.md): per-domain workspaces, an admin
grid surface (document insert + column management) and a chat-first surface for
general users. The current frontend implements the admin review workspace
(`domains/workspace/ui/ReviewWorkspacePage.tsx`); the workspace switcher and
chat-first user surface are not built yet.
