# AgentTrust

AgentTrust is a blockchain-backed execution verification and trust scoring platform for AI agents. It lets users register agents, run tasks through sandboxed execution providers, capture execution evidence, compute proof hashes, and anchor those proofs on Stellar Mainnet.

The project is organized as a full-stack app:

- **Frontend:** Next.js app for registration, login, agent discovery, execution dashboards, live sandbox views, wallet connection, and public verification pages.
- **Backend:** FastAPI API for auth, agent management, executions, trust scores, verification, desktop sessions, and Stellar anchoring.
- **Sandbox worker:** Standalone FastAPI worker that runs external Docker agents and returns structured telemetry.
- **Deployment stack:** Docker Compose production stack for backend, sandbox worker, and Nginx, with Vercel recommended for the frontend.

## Core Features

- Register and manage AI agents with metadata, provider, model, Docker image, commands, timeout, category, and required environment variables.
- Execute agents against user tasks and persist stdout, stderr, exit code, timing, final output, action logs, routing mode, and run status.
- Support multiple execution providers:
  - `openrouter`
  - `browser`
  - `external_docker`
- Run external Docker agents locally or through a decoupled sandbox worker.
- Stream run snapshots for live execution consoles.
- Support interactive desktop execution sessions with VNC/noVNC connection metadata.
- Compute evidence hashes for every execution.
- Anchor run evidence on Stellar Mainnet.
- Verify public run proofs by recomputing hashes and checking stored blockchain metadata.
- Calculate trust scores from verified execution history.
- Connect Stellar wallets through the frontend.

## Repository Layout

```text
.
+-- backend/                 FastAPI app, database models, API routes, services, tests, Alembic migrations
+-- frontend/                Next.js 16 app, React components, wallet integration, API client
+-- sandbox-worker/          Standalone Docker execution worker
+-- deploy/                  Production Docker Compose and Nginx config
+-- external-agents/         Example external agent implementations
+-- scripts/                 Local development and build helper scripts
+-- tests/                   Test fixtures and compliant external agent sample
+-- codex_ppt_build/         Architecture deck generation assets
+-- DEPLOYMENT_STAGING.md    Public deployment guide
+-- mainnet_audit_report.md  Mainnet readiness/audit notes
+-- verify_deployment.py     End-to-end deployment smoke test
```

## Architecture

```text
User
  -> Next.js frontend
  -> FastAPI backend
  -> Postgres database
  -> Execution provider
       -> OpenRouter / browser / local Docker / sandbox worker
  -> Evidence hash
  -> Stellar Mainnet anchor
  -> Public verification page
```

Production target:

```text
Vercel
  -> Next.js frontend

AWS EC2
  -> Nginx
  -> FastAPI backend
  -> sandbox-worker
  -> host Docker daemon

Neon / Postgres
  -> application data

Stellar Mainnet
  -> execution proof anchoring
```

## Prerequisites

- Node.js and npm
- Python 3.12 recommended
- PostgreSQL-compatible database
- Docker, required for external Docker agents and the sandbox worker
- Stellar Mainnet account/keypair for production anchoring
- Optional: Freighter browser wallet for frontend wallet connection

## Local Setup

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env`:

```text
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/agenttrust
JWT_SECRET=change-this-secret-key
ENVIRONMENT=development
DEBUG=true
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

STELLAR_SECRET_KEY=
STELLAR_PUBLIC_KEY=
STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_MAX_BASE_FEE=10000

OPENROUTER_API_KEY=
SANDBOX_WORKER_URL=http://localhost:8001
```

Run the backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check:

```powershell
curl http://127.0.0.1:8000/health
```

API docs are available at:

```text
http://127.0.0.1:8000/docs
```

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

For local development, set `frontend/.env.local` if needed:

```text
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
```

### 3. Single-Command Local App

After backend dependencies and frontend dependencies are installed, this helper starts both services:

```powershell
node scripts/dev-single-server.mjs
```

It starts:

- Backend on `http://127.0.0.1:8000`
- Frontend on `http://127.0.0.1:3000`

## Sandbox Worker

The sandbox worker runs external Docker agents outside the main backend process.

```powershell
cd sandbox-worker
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn worker:app --host 0.0.0.0 --port 9000
```

Health check:

```powershell
curl http://127.0.0.1:9000/health
```

Point the backend to the worker:

```text
SANDBOX_WORKER_URL=http://127.0.0.1:9000
```

When this value is set, `external_docker` executions are forwarded to the worker. When it is unset, AgentTrust falls back to its local Docker runner.

See `sandbox-worker/README.md` and `sandbox-worker/agent_contract.md` for the full worker contract.

## External Agent Contract

External agents can be any Docker image. For richer evidence, they should follow the AgentTrust contract:

- Read task input from `$AGENTTRUST_INPUT`.
- Write final structured output to `$AGENTTRUST_OUTPUT`.
- Write action steps to `$AGENTTRUST_ACTION_LOG`.

If an image does not write these files, the worker still captures stdout, stderr, exit code, and execution time, then synthesizes fallback output.

## Main API Routes

All application routes are mounted under `/api`.

- `POST /api/register` - create a user account
- `POST /api/login` - authenticate and receive a JWT
- `GET /api/me` - fetch the current user
- `PUT /api/me/wallet` - connect a Stellar wallet
- `DELETE /api/me/wallet` - disconnect a Stellar wallet
- `GET /api/agents` - list and search public agents
- `POST /api/agents` - register an agent, developer accounts only
- `GET /api/agents/{agent_id}` - get agent details
- `PUT /api/agents/{agent_id}` - update an owned agent
- `DELETE /api/agents/{agent_id}` - deactivate an owned agent
- `POST /api/execute` - execute an agent
- `GET /api/runs` - list authenticated user runs
- `GET /api/runs/{run_id}` - get a run
- `GET /api/runs/{run_id}/stream` - stream execution snapshots
- `GET /api/v1/runs/{run_id}/logs` - fetch captured logs
- `GET /api/trust/{agent_id}` - fetch trust score
- `GET /api/verify/{run_id}` - publicly verify a run
- `GET /api/sandbox/health` - inspect sandbox routing and worker health
- `GET /api/v1/desktop/{run_id}/status` - desktop execution status
- `GET /api/v1/desktop/{run_id}/connect-info` - desktop connection details
- `POST /api/v1/desktop/{run_id}/heartbeat` - keep a desktop session alive
- `POST /api/v1/desktop/{run_id}/stop` - stop a desktop session

## Tests and Checks

Backend tests:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

Frontend checks:

```powershell
cd frontend
npm run lint
npm run type-check
npm run build
```

Deployment smoke test:

```powershell
$env:AGENTTRUST_FRONTEND_URL="https://your-vercel-app.vercel.app"
$env:AGENTTRUST_BACKEND_URL="http://YOUR_EC2_PUBLIC_IP"
$env:AGENTTRUST_ACCESS_TOKEN="your-jwt-token"
$env:STELLAR_NETWORK="mainnet"
backend\.venv\Scripts\python.exe verify_deployment.py
```

The smoke test verifies frontend visibility, backend health, cloud sandbox routing, Docker execution, telemetry persistence, execution hashing, Stellar transaction creation, and public verification output.

## Production Deployment

Use the production deployment guide in `DEPLOYMENT_STAGING.md`.

Recommended production split:

- Deploy the frontend from `frontend/` to Vercel.
- Deploy the backend, sandbox worker, and Nginx on EC2 with `deploy/compose.production.yml`.
- Use Neon or another PostgreSQL provider for `DATABASE_URL`.
- Keep Docker sandbox execution on EC2 or another host with access to a real Docker daemon.

Start the production backend stack on EC2:

```bash
docker compose -f deploy/compose.production.yml up -d --build
```

Production health checks:

```bash
curl http://YOUR_EC2_PUBLIC_IP/health
curl http://YOUR_EC2_PUBLIC_IP/api/sandbox/health
curl http://YOUR_EC2_PUBLIC_IP/sandbox/health
```

Do not deploy `sandbox-worker` to Vercel, Render, Railway, or serverless infrastructure.

## Security Notes

Never commit:

- `backend/.env`
- `frontend/.env.local`
- `deploy/.env.production`
- SSH keys
- `.pem` files
- Stellar secret keys
- JWT secrets

Production startup validates Stellar Mainnet configuration and fails if the keypair, network, Horizon URL, database URL, or JWT secret are unsafe.

## Generated Architecture Materials

This repository includes Canva-editable architecture deck assets:

- `AgentTrust_Architecture_Overview_Canva_Editable.pptx`
- `AgentTrust_Architecture_Overview_6_Slides_Canva_Editable.pptx`
- Rendered slide PNGs in matching folders
- Deck generation source in `codex_ppt_build/`

These files are documentation/presentation assets and are not required to run the app.
