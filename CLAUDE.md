# Kalex (repo: Tabular_Review) — Monorepo Guide

**Kalex** is a legal-document knowledge base with an agentic chat front end:
law firms upload documents, the system structures them into a queryable DB
(Docling conversion → chunking/embedding → on-prem LLM extraction into a
spreadsheet-style grid, human-verified per cell), and an **Agent Chat** answers
questions by agentically navigating that catalog (DB → columns →
documents/cells/chunks) with citations. **The chat is the product's primary
surface**; the extraction grid (feature name "Tabular Review") is the admin
tool that builds and verifies the structured data
([docs/domain-design.md](docs/domain-design.md) §9 #18).

This file orients you across the repo. Each app has its own `CLAUDE.md` with the
detail that matters when working inside it — **read the relevant one before
editing that app.**

## Source of truth

[docs/domain-design.md](docs/domain-design.md) is the **single source of truth**
for the domain model, database tables, and API contract (entities, bounded
contexts, ERD, Postgres+pgvector DDL, REST endpoints, retrieval pipeline). When
implementing or changing anything in that space, **align to that document — and
when reality diverges, update the document in the same change.** Treat it as a
living spec, not a snapshot. (The standalone UI/UX spec `docs/screen-plan.md`
was retired once the screens shipped; the remaining chat-UI criteria live in
`docs/phase-4-chat-plan.md` §4.1.)

## Layout

```
.
├── frontend/      Next.js App Router + Feature-Sliced Design (FSD). See frontend/CLAUDE.md
├── backend/       FastAPI + DDD (bounded contexts, ports & adapters). See backend/CLAUDE.md
├── docs/          domain-design.md = 도메인/테이블/API 진실원천; phase-4-chat-plan.md = 챗(Agentic Search) 구현 계획 + 챗 UI 기준
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
                ├─ /document-dbs… /documents… /columns…   DocumentDB + ingestion REST
                ├─ /runs… /cells…                         extraction REST (grid)
                ├─ POST /convert                          Docling: PDF/DOCX → Markdown
                └─ POST /llm/chat/completions             proxy → on-prem vLLM (OpenAI-compatible)
```

- The frontend never talks to vLLM directly — it goes through the backend proxy
  (keeps the API key server-side, avoids browser CORS).
- Documents live server-side (object storage + Markdown + chunks/embeddings in
  Postgres+pgvector); the frontend holds metadata only and fetches content for
  the viewer.
- The API contract is specified in [docs/domain-design.md](docs/domain-design.md)
  §6: Pydantic schemas in the backend, mirrored as Zod in the frontend
  (see frontend/CLAUDE.md). The chat endpoints (§6.5, agentic search + SSE) are
  the current implementation focus ([docs/phase-4-chat-plan.md](docs/phase-4-chat-plan.md)).

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

The **chat-first user surface**
(`frontend/src/domains/chat/ui/ChatMainPage.tsx`) is the product's primary
surface; the admin grid (document insert + column management,
`frontend/src/domains/document-db/ui/DocumentDbReviewPage.tsx`) is the
DB-building tool. Backend contexts `document_db` / `ingestion` / `extraction`
are implemented; the **`chat` bounded context (Agentic Search) is the current
top priority** — plan in [docs/phase-4-chat-plan.md](docs/phase-4-chat-plan.md).
