# Frontend — Next.js App Router + FSD

React UI for **Kalex** — a chat-first legal-document knowledge base: the Agent
Chat surface is the product's primary screen, and the extraction grid (feature
name "Tabular Review") is the admin surface that builds the data behind it
(see `../docs/domain-design.md` §9 #18). Built on **Next.js App Router** and organized with
**Feature-Sliced Design (FSD)**. Follows the standards in
`../.claude/skills/frontend-engineer-persona/` — read it (and `guides/fsd-architecture.md`)
before adding features.

> **Source of truth:** domain model + API contract live in
> [../docs/domain-design.md](../docs/domain-design.md). Frontend Zod schemas mirror
> that doc (entities → `z.infer` types, endpoints → API 3-file pattern). When the
> contract changes, update the doc and the Zod mirror together. UI/UX spec:
> `../docs/screen-plan.md`.

## Tech stack

- **Next.js (App Router)** + **React 19** + **TypeScript** (strict)
- **TanStack Query** — server state (provider wired in `app/providers.tsx`)
- **Zustand** — client state (installed; stores not yet extracted — see Roadmap)
- **Zod** — runtime schemas / type source (installed; schemas not yet added)
- **Axios** — HTTP client (installed; current code still uses `fetch` — see Roadmap)
- **Tailwind CSS** — styling (real build; replaced the old CDN script)
- **Biome** — lint + format
- **pnpm** — package manager (do not use npm)

## FSD layers

```
src/
├── app/         Next.js routing only. Thin: imports a domain page, wires providers.
├── domains/     Business domains (each a slice with a Public API index.ts)
│   ├── document-db/      Workspace (DocumentDB) list, left rail, grid page shell
│   ├── document-review/  Grid, columns, verification, extraction, doc upload, viewer
│   └── chat/             Agent Chat (primary surface): main page, sessions, sources
├── widgets/     (reserved) cross-domain composite UI blocks
├── features/    (reserved) reusable cross-domain features
└── shared/      Pure technical code (no business logic), organized by segment:
    ├── api/     config.ts (base URLs), llm-client.ts (vLLM transport)
    ├── lib/     encoding.ts (base64)
    ├── config/  env.ts (NEXT_PUBLIC_* reads)
    ├── types/   view.ts (ViewMode, SidebarMode)
    └── ui/      icons.ts
```

### Segment placement (within a slice)

| Code | Segment |
|---|---|
| JSX components | `ui/` |
| types, stores, Context | `model/` |
| API functions / query hooks | `api/` |
| pure utils / self-contained hooks | `lib/` |
| constants, sample data | `config/` |

## Import rules (enforced)

`scripts/check-fsd-imports.mjs` enforces:

1. **Layer direction**: `app → domains → widgets → features → shared`. A layer
   may only import equal-or-lower layers. (Note: per the persona, `domains` is
   ABOVE `widgets`/`features` — a widget cannot import a domain.)
2. **Public API**: cross-slice imports within `domains`/`widgets`/`features` must
   go through the slice's `index.ts` (`@/domains/chat`), never a deep path
   (`@/domains/chat/ui/...`). Intra-slice imports use relative paths
   (`../model/types`). `shared`/`app` are segment-organized and exempt from rule 2.

Run: `pnpm lint:fsd` (or `pnpm lint` for Biome + FSD).

Path alias: `@/*` → `src/*`.

## Where things live (current code)

| Concern | Location |
|---|---|
| Chat main page (primary surface) + sessions | `domains/chat/ui/{ChatMainPage,ChatInterface,ChatSessionList}.tsx` |
| Workspace (DocumentDB) list / rail / grid page | `domains/document-db/ui/{DocumentDbListPage,DocumentDbRail,DocumentDbReviewPage}.tsx` |
| Grid / cells | `domains/document-review/ui/DataGrid.tsx` |
| Column add/edit + template library | `domains/document-review/ui/{AddColumnMenu,ColumnLibrary}.tsx` |
| Cell citation / verification + document viewer | `domains/document-review/ui/{VerificationSidebar,DocumentViewer}.tsx` |
| Extraction (runs/cells API) | `domains/document-review/api/extraction*.ts` |
| Docling convert call | `domains/document-review/api/document-processor.ts` |
| Chat API (mock → real in phase 4) | `domains/chat/api/chat.api.ts` |
| Generic vLLM transport | `shared/api/llm-client.ts` |
| Backend base URLs / mock toggles | `shared/api/config.ts` + `shared/config/env.ts` (`ENV.mocks.*`) |

## Commands

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build (also typechecks)
pnpm typecheck    # tsc --noEmit
pnpm lint         # Biome + FSD import check
pnpm lint:fix     # Biome autofix
```

Env: copy `.env.example` to `.env.local`. Client vars MUST be `NEXT_PUBLIC_*`
(read only via `shared/config/env.ts`).

## Migration status & roadmap

This is a structural migration from the original Vite SPA. **Working, building,
typechecked** — but several persona patterns are intentionally deferred to keep
the move reviewable:

- `ReviewWorkspacePage.tsx` still holds all state via `useState` (ported from
  `App.tsx`). **Next**: extract into Zustand stores under
  `domains/*/model/` (Provider + selector pattern) and TanStack Query hooks for
  extraction/conversion.
- API calls use `fetch`; migrate to the Axios wrapper + **API 3-file pattern**
  (`*.types.ts` Zod / `*.api.ts` / `*.hooks.ts`) per the persona.
- No Zod schemas yet — domain types are hand-written interfaces in `model/types.ts`.
  Add Zod as the single source of truth and infer types.
- `shared/ui/icons.ts` is a lucide barrel; react-best-practices prefers direct
  imports — fine for now, revisit if bundle matters.
- No tests/Husky yet; add Vitest + Playwright + a pre-commit hook (persona Init
  checklist) when feature work resumes.
- Product screens (see `../docs/screen-plan.md`): workspace switcher (left
  rail), workspace list, and the chat-first user surface are built. **Next
  (top priority): chat mock → real** — SSE step timeline, chunk/cell source
  chips, server-persisted sessions (`../docs/phase-4-chat-plan.md` PR-C).
