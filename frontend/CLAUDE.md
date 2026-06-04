# Frontend — Next.js App Router + FSD

React UI for Tabular Review. Built on **Next.js App Router** and organized with
**Feature-Sliced Design (FSD)**. Follows the standards in
`../.claude/skills/frontend-engineer-persona/` — read it (and `guides/fsd-architecture.md`)
before adding features.

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
│   ├── workspace/        Review workspace shell + project save/load (the admin grid screen)
│   ├── document-review/  Grid, columns, verification, extraction, doc upload
│   └── chat/             Analyst chat over the extracted dataset
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
| Review workspace screen (the old `App.tsx`) | `domains/workspace/ui/ReviewWorkspacePage.tsx` |
| Grid / cells | `domains/document-review/ui/DataGrid.tsx` |
| Column add/edit + template library | `domains/document-review/ui/{AddColumnMenu,ColumnLibrary}.tsx` |
| Cell citation / verification | `domains/document-review/ui/VerificationSidebar.tsx` |
| Extraction (LLM per cell) | `domains/document-review/api/extraction.api.ts` |
| Docling convert call | `domains/document-review/api/document-processor.ts` |
| Chat | `domains/chat/ui/ChatInterface.tsx` + `api/chat.api.ts` |
| Generic vLLM transport (shared by both) | `shared/api/llm-client.ts` |
| Backend base URLs | `shared/api/config.ts` (+ `shared/config/env.ts`) |

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
- Product screens still to build (see `../docs/screen-plan.md`): workspace
  switcher (left rail), admin workspace list, chat-first user surface with
  read-only grid. `widgets/` and `features/` are reserved for these.
