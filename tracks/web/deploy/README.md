# Deploy Notes

## Goal

This directory keeps optional deployment notes for the current Web host line.

Current assumptions:

- keep the existing file-based persistence for now
- deploy on a personal machine or server via `docker compose`
- allow different users to choose their own reverse proxy / tunnel habits
- default public quickstart is split-port deployment, not a built-in gateway stack

## Files

- `../docker-compose.dev.yml`
  - workspace dev compose, uses `whiteboard-frontend-dev` / `whiteboard-backend-dev`
  - exposes frontend and backend directly by port
- production deploy copy in your own deployment directory
  - must keep `whiteboard-frontend` / `whiteboard-backend`

## Default recommendation

For a simple public or LAN deployment, the easiest model is still:

- expose one frontend port
- expose one backend port
- point `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` at the backend address

This avoids coupling the project to any specific reverse proxy choice.

## Optional reverse proxy

If you prefer a same-origin domain model with HTTPS termination, host/path routing, or tunnel integration, you can still place your own reverse proxy in front of the two services.

That proxy layer is intentionally outside this repository's default deployment contract.

## Example deployment flow

1. Copy the required project files into your own deployment directory
2. Ensure the production compose file keeps production container names:

```yaml
backend.container_name: whiteboard-backend
frontend.container_name: whiteboard-frontend
```

3. Create deployment env file:

```bash
cp .env.deploy.example .env
```

Fill the required values in `.env`, especially OCR-related secrets if you need OCR.
4. Run:

```bash
docker compose --env-file .env build
docker compose --env-file .env up -d
```

If the backend image ever builds successfully in local Cargo but fails in Docker with missing `whiteboard_shared` types, check the backend Dockerfile first. The current version intentionally copies the full workspace before the release build instead of using a stub prebuild layer, because the stub path proved fragile during deployment verification.

## Frontend network model

The frontend now supports two modes cleanly:

- development
  - Vite proxy forwards `/api` and `/ws` to `VITE_DEV_PROXY_TARGET`
- production / Docker (split ports or custom reverse proxy)
  - set `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` if frontend and backend are not same-origin
  - or leave them empty if you already provide same-origin routing outside the app
  - frontend image supports build-time `VITE_*` injection via Docker build args

## Config coverage

Compose services:

- `backend`
- `frontend`

Backend runtime envs currently expected by the deployment scaffold:

- `APP_HOST`
- `APP_PORT`
- `WS_MESSAGE_CODEC`
- `ROOM_SNAPSHOT_FORMAT`
- `OCR_BASE_URL`
- `OCR_API_KEY`
- `OCR_AUTH_HEADER`
- `OCR_AUTH_SCHEME`
- `OCR_MODEL`
- `OCR_REQUEST_FORMAT`
- `OCR_TIMEOUT_MS`
- `OCR_PROVIDER`

Frontend build-time envs currently supported by the deployment scaffold:

- `VITE_API_BASE_URL`
- `VITE_WS_BASE_URL`
- `VITE_FRONTEND_ORIGIN`
- `VITE_WS_MESSAGE_CODEC`
- `VITE_WS_LAYER_OP_CODEC`

Frontend dev-only envs:

- `VITE_DEV_PROXY_TARGET`
- `VITE_DEV_ALLOWED_HOSTS`

## Recommended fill strategy

- simple split-port deploy
  - set `VITE_API_BASE_URL=http://<backend-host>:<port>`
  - set `VITE_WS_BASE_URL=ws://<backend-host>:<port>`
  - set `VITE_FRONTEND_ORIGIN=http://<frontend-host>:<port>` when needed
- same-origin reverse-proxy deploy
  - keep `VITE_API_BASE_URL=` empty
  - keep `VITE_WS_BASE_URL=` empty
  - keep `VITE_FRONTEND_ORIGIN=` empty
- backend defaults usually keep as-is
  - `APP_HOST=0.0.0.0`
  - `APP_PORT=3000`
  - `WS_MESSAGE_CODEC=json`
  - `ROOM_SNAPSHOT_FORMAT=json`
- OCR only fill when you need OCR in production
  - `OCR_BASE_URL`
  - `OCR_API_KEY`
  - sometimes `OCR_MODEL`

## Current non-goals

- no PostgreSQL yet
- no Tauri packaging yet
- no automatic sync from the development workspace to your deployment copy
