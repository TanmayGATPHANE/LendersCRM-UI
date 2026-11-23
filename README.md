# AMS UI

Collateral-lending UI: React 18 + Vite 5 + Tailwind v4 + TypeScript.
The app itself lives in **[`frontend/`](frontend/README.md)**; this repo root
carries its build and deploy files.

```
lenders-crm-ui/
├── Dockerfile        ← THE UI image (nginx + built SPA + /api proxy)
├── nginx.conf        ← SPA fallback, asset caching, /api → api:8080
├── .dockerignore     ← trims the build context (node_modules, dist, .env*)
└── frontend/         ← Vite app (src/, package.json, vite.config.js)
    ├── .env.development   ← committed: local `npm run dev` → http://localhost:5246
    ├── .env.production    ← committed: static/Vercel build → deployed API URL
    ├── .env.example       ← template for overrides
    └── .env.local         ← gitignored, machine-local overrides (not used by Docker)
```

## Local development

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173  → API http://localhost:5246
```

Start the API first: `dotnet run --project ../../lenders-crm-backend/Api`.
To point the UI elsewhere (or run on sample data) edit `frontend/.env.local`
and restart the dev server:

```dotenv
VITE_API_URL=https://lenderscrm-api.onrender.com   # or another API
# VITE_USE_MOCK=1                                  # in-memory demo data
```

The login screen badge always shows the URL the running build will call.

## Environment files (UI)

| File | Committed? | Read when | Value |
|---|---|---|---|
| `frontend/.env.development` | yes | `npm run dev` | `VITE_API_URL=http://localhost:5246` |
| `frontend/.env.production` | yes | `npm run build` / Vercel | `VITE_API_URL=https://lenderscrm-api.onrender.com` |
| `frontend/.env.local` | no | both (highest priority) | machine overrides |
| Vercel Project Settings | — | Vercel build | overrides all of the above |

Vite inlines `VITE_*` into the bundle at build time — changing a value needs
a new build (or dev-server restart).

## Docker

The repo builds its own image; `docker-compose.yml` (workspace root) connects
it to the API and database services.

```bash
# From this repo — standalone image
docker build -t ams-web .
docker run -p 8081:80 ams-web     # needs an `api` host or VITE_API_URL at build

# Same-origin image used by the compose stack
docker build -t ams-web .         # VITE_API_URL="" → /api → nginx → api:8080
```

The compose stack is the normal way to run all three containers together:
`web` (this repo), `api` (`../lenders-crm-backend`), `db` (SQL Server image).
