# Backend — FastAPI + DDD

FastAPI backend for **Kalex** — a legal-document knowledge base whose primary
surface is an **Agent Chat** (agentic search over the document catalog). The
backend ingests documents (Docling → Markdown → chunks/embeddings in
Postgres+pgvector), manages document DBs and extraction columns, runs LLM
extraction into the verified grid, and proxies the on-prem vLLM. The **`chat`
bounded context (Agentic Search) is the current top priority** — plan in
[../docs/phase-4-chat-plan.md](../docs/phase-4-chat-plan.md). Structured with
**Domain-Driven Design + ports & adapters (hexagonal)** so business logic stays
independent of FastAPI, Docling, and httpx.

> **Source of truth:** the domain model, tables, and API contract are specified in
> [../docs/domain-design.md](../docs/domain-design.md) — bounded contexts
> (`identity` / `document_db` / `ingestion` / `extraction` / `chat` + infra
> `document_conversion` / `llm` / `embedding`), entities, Postgres+pgvector DDL,
> REST endpoints, and the BGE-M3 / BGE-Reranker-V2-M3 retrieval pipeline.
> Implement against that doc; if reality diverges, update the doc in the same change.

## Architecture

Each capability is a **bounded context** under `app/domains/<context>/`, split
into four layers:

```
app/
├── main.py                  # Composition root — the ONLY place that builds concrete adapters
├── core/
│   ├── config.py            # Settings (pydantic-settings); single env source of truth
│   └── logging.py
└── domains/
    └── <context>/
        ├── domain/          # Pure business model — no framework imports
        │   ├── models.py    # Value objects / entities (dataclasses)
        │   └── ports.py     # Abstract interfaces (ABCs) + domain errors
        ├── application/
        │   └── service.py   # Use cases; depend on ports only
        ├── infrastructure/  # Adapters implementing ports (Docling, httpx/vLLM, HF)
        └── interface/       # FastAPI: router.py, schemas.py (DTOs), dependencies.py
```

### Dependency rule (inward only)

```
interface ──▶ application ──▶ domain ◀── infrastructure
                                  ▲
                          (ports defined here; infra implements them)
```

- `domain/` imports nothing from other layers and no third-party framework.
- `application/` depends only on `domain` (ports + models). Never imports
  infrastructure or FastAPI.
- `infrastructure/` implements `domain/ports.py` and is the only place allowed to
  import Docling / httpx / huggingface_hub.
- `interface/` translates HTTP ⇄ application; holds Pydantic DTOs (`schemas.py`).
- **Wiring (which concrete adapter implements which port) happens only in
  `main.py`** via `create_app()`, which stores services on `app.state` and
  exposes them through `interface/dependencies.py`. This keeps services testable
  (`app.dependency_overrides`) and adapters swappable.

## Bounded contexts (current)

| Context | Responsibility | HTTP surface |
|---|---|---|
| `document_db` | DocumentDB + extraction-schema columns | `/document-dbs…`, `/columns…` |
| `ingestion` | Upload → convert → chunk → embed; document content/file | `/document-dbs/{id}/documents`, `/documents…` |
| `extraction` | Cell extraction runs + review | `/runs…`, `/cells…`, `/document-dbs/{id}/cells` |
| `chat` *(next — top priority)* | Agentic Search sessions/messages + SSE | `/chat/sessions…` (planned, §6.5) |
| `document_conversion` *(infra)* | Docling PDF/DOCX → Markdown (MPS/CPU, Tesseract OCR, UTF-8-decode fallback) | `POST /convert` |
| `llm` *(infra)* | on-prem vLLM / OpenRouter proxy (bearer auth only when key ≠ `EMPTY`) | `POST /llm/chat/completions` |
| `embedding` / `storage` *(infra)* | BGE-M3 embeddings (HF TEI), object storage | — (ports only) |

Conversion behavior preserved from the original `server/main.py`: OCR eng+kor,
retry without OCR on UTF-8 decode errors, pypdfium2 PDF backend, optional HF
TLS-verify bypass (configured before the converter is built), default-model
injection on proxy.

## Adding a new bounded context

1. `mkdir app/domains/<ctx>/{domain,application,infrastructure,interface}` (+ `__init__.py`).
2. Define `domain/models.py` (value objects) and `domain/ports.py` (ABC + errors).
3. Implement the use case in `application/service.py` against the port.
4. Implement the adapter in `infrastructure/`.
5. Add `interface/{schemas,router,dependencies}.py`.
6. Wire it in `main.py`: build the adapter + service, set on `app.state`,
   `app.include_router(...)`.

## Config

All env vars are declared in `core/config.py` (`Settings`, pydantic-settings).
Never read `os.environ` outside it. Key vars: `VLLM_BASE_URL`, `VLLM_API_KEY`
(`EMPTY` ⇒ no auth header), `VLLM_MODEL`, `DOCLING_OCR_*`, `DOCLING_PDF_BACKEND`,
`DOCLING_HF_DISABLE_SSL_VERIFY`, `CORS_ORIGINS`. See `../.env.example`.

## Dependencies

Managed with **uv**: `pyproject.toml` declares deps, `uv.lock` pins the full
resolved tree (committed). `torch`/`torchvision` resolve to CPU wheels from the
PyTorch CPU index on Linux (small Docker image) and to the default MPS-capable
wheels on macOS. To change deps, edit `pyproject.toml` then run `uv lock`.

## Commands

```bash
# Local run (uv syncs .venv from the lockfile, runs uvicorn; MPS on macOS)
../start-backend.sh

# Or manually with uv
uv sync
uv run uvicorn app.main:app --reload --port 8000

# Prefetch Docling models (offline/air-gapped installs)
uv run python scripts/download_docling_models.py

# Update the lockfile after editing pyproject.toml
uv lock

# Syntax check without heavy deps
python -m compileall -q app
```

Docs at `http://localhost:8000/docs`. `docling` + `torch` are heavy; the domain,
application, and `llm` layers import without them (only `infrastructure/docling_converter.py`
and `main.py` need Docling).

## Conventions & roadmap

- Keep Docling/httpx/HF imports inside `infrastructure/`. If you find them
  leaking into `application/` or `domain/`, that's a bug.
- No tests yet — add `tests/<context>/` using fake adapters against the ports
  (the ports exist precisely to make this trivial; see the wiring smoke test
  approach used during the migration).
- Remaining contexts: **`chat` (Agentic Search) — top priority**
  (`../docs/phase-4-chat-plan.md`), then `identity` (auth/roles). Each follows
  the same 4-layer shape.
