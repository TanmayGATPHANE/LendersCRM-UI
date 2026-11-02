# AMS — Frontend (React UI)

The user-facing app for the **Amanat Management System** — collateral lending:
record money lent against an item, top-up (sub) lends, partial returns,
releases, customers, cash book, reports and an admin activity log.

## Stack

- **React 18** + **Vite 5** + **Tailwind v4** (design tokens live in `src/index.css`)
- **TypeScript everywhere** — every file is `.ts/.tsx`; `tsc -b` runs inside `npm run build`, so a type error fails the build
- **react-router-dom v6** — route guards for auth + role (`Admin` only: Users, Activity)
- Icons: Phosphor (`@phosphor-icons/web`)

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

The UI has two data modes, decided by `VITE_USE_MOCK`:

| Mode | How | What you get |
|---|---|---|
| **Real API** (default) | just `npm run dev` | talks to the .NET API at `VITE_API_URL` (default `http://localhost:5246`) — start the backend first (`dotnet run` from `../../lenders-crm-backend/Api`) |
| **Mock / demo** | `VITE_USE_MOCK=1` (`.env.local`, or set it in Vercel/`vercel.json` build env) | in-memory sample data, no server needed — used by the public demo |

### Environment variables

| Name | Default | Meaning |
|---|---|---|
| `VITE_USE_MOCK` | unset (real API) | `1` switches the whole data layer to the in-memory mock |
| `VITE_API_URL` | `http://localhost:5246` | base URL of the .NET API |

### Scripts

```bash
npm run dev        # dev server
npm run build      # typecheck (tsc -b) + production bundle
npm run preview    # serve the production build locally
```

## Project layout

```
src/
  api/          typed API layer — one DataLayer interface, two impls
    client.ts      mode switch + http helper (auth header from localStorage `ams_user`)
    types.ts       all domain types (Entry, CollateralGroup, ActivityItem…)
    mockApi.ts     the in-memory mock
  pages/        one file per screen (Dashboard, Customers, Cash, Reports, Login, Users, Activity)
  components/
    table/       the shared groups table (Dashboard + customer History), ledger, flash row
    dialogs/     entry / sub-lend / partial / release modals
    viz/         report charts (shared chart primitives)
    …            layout shell, search, bell, toasts, LoadMore paging
  utils/        money/date formatting, ledger math, interest accrual
```

Conventions worth keeping:

- The server owns computations (insights, reports, search) — the UI renders results, never re-derives them
- Lists page in chunks (`components/LoadMore.tsx`, page size 50) so big data stays fast
- Money strings come formatted from the API; formatting helpers live in `src/utils/format.ts`

## Deployment (Vercel)

The frontend deploys as a static site. With the project connected to git, every
push to `main` auto-builds and releases (preview URLs for other branches). The
public demo (`ams-crm-demo.vercel.app`) runs in mock mode via `build.env` in
`vercel.json`.

The .NET 10 backend lives in `../../lenders-crm-backend` — see the project
`CLAUDE.md` and `.claude/skills/lenders-crm-dev/SKILL.md` for backend conventions.