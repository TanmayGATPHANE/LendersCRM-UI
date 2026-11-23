# AMS UI image — one Dockerfile per repo.
#
# BUILD CONTEXT IS THIS REPO (`lenders-crm-ui/`); the Vite app lives in
# `frontend/`. Used by docker-compose.yml at the workspace root, and usable
# standalone:
#
#   docker build -t ams-web .
#   docker build -t ams-web --build-arg VITE_API_URL=https://lenderscrm-api.onrender.com .
#
# Endpoint rules:
#   · build arg VITE_API_URL unset/empty → SAME-ORIGIN: the SPA calls /api/...
#     and nginx forwards it to the `api` service (the compose stack).
#   · build arg VITE_API_URL=<absolute URL> → standalone image calling that API.
#   · Vercel/static builds do NOT use this file; they read the committed
#     frontend/.env.production (dashboard env vars override it).
# `.env*` files are excluded from this build context on purpose — see
# .dockerignore — so a committed deployment URL can never leak into the
# same-origin image.
FROM node:22-alpine AS build
WORKDIR /app

# Dependency layer first, so npm ci caches between source changes.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_URL=""
ARG VITE_USE_MOCK=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_USE_MOCK=$VITE_USE_MOCK

# tsc -b runs inside npm run build, so a type error fails the image build.
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
