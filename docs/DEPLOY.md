# Deployment

GrantProof deploys as two parts: the **frontend on Vercel** and the **backend on Render**. The backend can't run as Vercel serverless functions. Proposal reviews and document ingestion keep running after the request returns, uploads are saved to disk, and run progress lives in memory.

## Backend (Render)

`render.yaml` at the repo root is a Render Blueprint for the `grantproof-api` web service.

1. In Render, choose **New → Blueprint** and pick this repository (or your fork).
2. When prompted, set the two secret values:
   - `OPENROUTER_API_KEY`: your OpenRouter key.
   - `GG_CORS_ORIGINS`: the frontend's address, for example `https://grantproof.vercel.app`. Use a comma-separated list if there are several.
3. Deploy. Render installs with `uv sync --frozen --no-dev` and starts Uvicorn. `/healthz` returns `{"ok": true}` when the service is up.

On the free plan, the service sleeps after about 15 minutes idle, so the first request after that takes about a minute. Uploaded project files reset when it restarts. A paid instance with a persistent disk keeps uploads: mount the disk and point `GG_DATA_DIR` at it.

## Frontend (Vercel)

`vercel.json` at the repo root builds `frontend/` and serves `frontend/dist`. It also sends every app route (such as `/projects/…`) to the single-page app. No dashboard build settings are needed.

1. Import the repository in Vercel, keeping the root directory as the repo root.
2. Add the environment variable `VITE_API_BASE_URL` with the Render service URL (for example `https://grantproof-api.onrender.com`), then deploy.
3. Add the Vercel production address to the backend's `GG_CORS_ORIGINS`.

`VITE_API_BASE_URL` is read at build time, so redeploy the frontend after changing it. Without it, the site runs in source-pack preview mode with the AI features off. Preview deployments get their own addresses; add one to `GG_CORS_ORIGINS` only if it needs to reach the backend.

`.vercelignore` keeps `.env` files, virtualenvs and uploaded project data out of any upload made from a local machine.
