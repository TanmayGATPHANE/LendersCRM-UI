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
public demo (`ams-crm-demo.vercel.app`) builds against the Render-hosted API.

The endpoint lives **in this repo**, not only in a dashboard:

| File | Committed | Used by |
|---|---|---|
| `.env.development` | yes | `npm run dev` — `http://localhost:5246` |
| `.env.production` | yes | `npm run build` / Vercel — the deployed API URL |
| `.env.local` | no (gitignored) | machine overrides; wins over both |
| Vercel Project Settings | — | overrides every file above |

Vercel Project `ams-crm-demo` → Settings → Environment Variables also defines
`VITE_API_URL` and `VITE_USE_MOCK` (Production only); those win over
`.env.production`. `vercel.json` holds only the SPA rewrite and security
headers.

Vite inlines `VITE_*` at build time: changing a value needs a redeploy, and a
Preview deployment with no values of its own falls back to
`http://localhost:5246`.

## Container image

This repo builds its own image from `../Dockerfile` (context = repo root, app
in `frontend/`). The compose stack passes `VITE_API_URL=""` for same-origin
`/api` proxying; a standalone build can pass an absolute URL instead:

```bash
docker build -t ams-web --build-arg VITE_API_URL=https://lenderscrm-api.onrender.com ..
```

Committed `.env*` files are excluded from the image context, so a Vercel URL
can never leak into the same-origin image.

## Backend deployment values (Render)

The API service is built from `../../lenders-crm-backend/Dockerfile`; there is
no `render.yaml`. Render dashboard environment variables override
`Api/appsettings.json`:

| Variable | Meaning |
|---|---|
| `ConnectionStrings__Default` | production SQL Server connection |
| `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience` | token signing and validation |
| `CORS__AllowedOrigins` | comma-separated browser origins; must include the Vercel URL |
| `MigrateOnStartup=true` | apply EF migrations on boot |
| `ASPNETCORE_ENVIRONMENT=Production` | host environment |

The root files (`../../.env`, `.env.example`) belong to the Docker Compose
stack only; `dotnet run` and `npm run dev` never read them.
