# AgentTrust

> Verify AI agents before you trust them.

AgentTrust records AI-agent executions, turns their evidence into a reproducible cryptographic fingerprint, and anchors that proof on Stellar Mainnet.

> [!IMPORTANT]
> **Complete source code:** This README is displayed from the `main` branch so it is visible on the repository homepage. The complete and latest AgentTrust implementation is maintained in the [`current-development` branch](https://github.com/2823sanskar/AgentTrust/tree/current-development). Please switch to that branch before reviewing, building, or running the project.

For a new clone:

```bash
git clone --branch current-development https://github.com/2823sanskar/AgentTrust.git
cd AgentTrust
```

For an existing clone:

```bash
git fetch origin
git switch current-development
git pull origin current-development
```

## 1. Project Title

**AgentTrust**

## 2. Project Description

AgentTrust is a full-stack, blockchain-backed verification and reputation platform for AI agents. Developers can register agents, execute tasks through supported providers, inspect captured telemetry, and share a public proof for each run.

For every execution, AgentTrust stores the output, logs, exit status, timing, and action history. It normalizes that evidence into a SHA-256 hash and anchors the hash in a Stellar Mainnet transaction. Verified execution history is then used to calculate an agent trust score based on reliability, on-chain verification, and response time.

The platform supports OpenRouter agents, browser agents, external Docker agents, and interactive Docker desktop sessions.

## 3. Contract Address

| Field | Value |
| --- | --- |
| Network | Stellar Mainnet |
| Contract / anchor address | `GCPICED67VZ2VUESHTKMXZMWJJVSV4ZFULILSUQJS2GL77KBRHILDIN3` |
| Explorer | [View on Stellar Expert](https://stellar.expert/explorer/public/account/GCPICED67VZ2VUESHTKMXZMWJJVSV4ZFULILSUQJS2GL77KBRHILDIN3) |

> [!IMPORTANT]
> AgentTrust does not deploy an EVM or Soroban smart contract. The address above is the public Stellar account used to anchor execution proofs. Each proof is a signed self-payment transaction containing the run's 32-byte SHA-256 evidence hash in a `HashMemo`.

## How It Works

```mermaid
flowchart LR
    U["User"] --> F["Next.js frontend"]
    F --> A["FastAPI backend"]
    A --> D[("PostgreSQL")]
    A --> E{"Execution provider"}
    E --> O["OpenRouter"]
    E --> B["Browser agent"]
    E --> S["Docker sandbox"]
    E --> X["Interactive desktop"]
    E --> H["Normalized run evidence"]
    H --> P["SHA-256 fingerprint"]
    P --> T["Stellar Mainnet anchor"]
    T --> V["Public verification"]
    D --> R["Trust score"]
```

1. A developer registers an agent and its execution configuration.
2. A user submits a task to that agent.
3. AgentTrust routes the task to OpenRouter, a browser runner, or a Docker sandbox.
4. The backend captures stdout, stderr, output, timing, exit code, and action logs.
5. The normalized evidence is hashed and anchored on Stellar Mainnet.
6. Anyone can verify the run, its evidence hash, and its Stellar transaction.

## Core Features

- Agent registration, discovery, ownership, and lifecycle management
- JWT authentication and Stellar wallet connection through Freighter
- OpenRouter, browser, and external Docker execution providers
- Local or remote Docker sandbox worker support
- Live execution snapshots and persisted run telemetry
- Interactive noVNC desktop sessions with heartbeat and cleanup handling
- Deterministic SHA-256 evidence fingerprints
- Stellar Mainnet transaction anchoring and public proof verification
- Trust scores calculated from success rate, verified runs, latency, and failures
- Production deployment stack with Nginx, FastAPI, and a dedicated sandbox worker

## Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, TanStack Query |
| Backend | FastAPI, Python 3.11, SQLAlchemy 2, Pydantic, Uvicorn |
| Database | PostgreSQL with `asyncpg` and Alembic migrations |
| Blockchain | Stellar SDK, Stellar Mainnet, Horizon API, Freighter wallet |
| Execution | OpenRouter, Playwright, Docker, noVNC |
| Infrastructure | Docker Compose, Nginx, AWS EC2, Vercel |

## Repository Structure

```text
AgentTrust/
|-- backend/             FastAPI API, models, services, migrations, and tests
|-- frontend/            Next.js application and Stellar wallet integration
|-- sandbox-worker/      Isolated external-agent Docker execution service
|-- external-agents/     Example agent implementations
|-- deploy/              Production Compose and Nginx configuration
|-- scripts/             Local development helpers
|-- tests/               External-agent fixtures
|-- DEPLOYMENT_STAGING.md
|-- verify_deployment.py
`-- README.md
```

## Getting Started

### Prerequisites

- Python 3.11 or newer
- Node.js and npm
- PostgreSQL
- Docker, when running external agents or desktop sandboxes
- A funded Stellar Mainnet keypair, when submitting real on-chain proofs

### 1. Configure and run the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

```bash
# macOS or Linux
source .venv/bin/activate
```

Install dependencies and create the private environment file:

```bash
pip install -r requirements.txt
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

At minimum, review these values in `backend/.env`:

```dotenv
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/agenttrust
JWT_SECRET=replace-with-a-long-random-secret

STELLAR_SECRET_KEY=your-funded-mainnet-secret-key
STELLAR_PUBLIC_KEY=GCPICED67VZ2VUESHTKMXZMWJJVSV4ZFULILSUQJS2GL77KBRHILDIN3
STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org

OPENROUTER_API_KEY=
SANDBOX_WORKER_URL=
ENVIRONMENT=development
DEBUG=true
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

`STELLAR_SECRET_KEY` must correspond to `STELLAR_PUBLIC_KEY`. Keep it empty during local development if you do not want to submit real Mainnet transactions; runs will remain pending instead of receiving an on-chain receipt.

Start the API:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Configure and run the frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
```

Start the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 3. Run the optional sandbox worker

The worker is required for remote or decoupled `external_docker` execution. Docker must be running.

```bash
cd sandbox-worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn worker:app --host 0.0.0.0 --port 9000
```

On Windows, activate the environment with `.\.venv\Scripts\Activate.ps1`.

Then set this value in `backend/.env` and restart the backend:

```dotenv
SANDBOX_WORKER_URL=http://127.0.0.1:9000
```

Leave `SANDBOX_WORKER_URL` empty to use the backend's local Docker runner.

### Single-command development launcher

After installing the backend and frontend dependencies, start both applications from the repository root:

```bash
node scripts/dev-single-server.mjs
```

## External Agent Contract

An external agent may be any Docker image. For complete structured evidence, it should:

- Read the task from the path stored in `AGENTTRUST_INPUT`.
- Write its final JSON result to the path stored in `AGENTTRUST_OUTPUT`.
- Write its JSON action history to the path stored in `AGENTTRUST_ACTION_LOG`.

If those files are not created, AgentTrust still records stdout, stderr, exit code, and execution time. See [sandbox-worker/agent_contract.md](sandbox-worker/agent_contract.md) for the complete contract.

## API Overview

All application endpoints are under `/api`.

| Area | Main endpoints |
| --- | --- |
| Authentication | `POST /register`, `POST /login`, `GET /me` |
| Wallet | `PUT /me/wallet`, `DELETE /me/wallet` |
| Agents | `GET /agents`, `POST /agents`, `GET /agents/{agent_id}` |
| Executions | `POST /execute`, `GET /runs`, `GET /runs/{run_id}` |
| Live evidence | `GET /runs/{run_id}/stream`, `GET /v1/runs/{run_id}/logs` |
| Trust | `GET /trust/{agent_id}` |
| Verification | `GET /verify/{run_id}` |
| Sandbox | `GET /sandbox/health` |
| Desktop | `/v1/desktop/{run_id}/status`, `/connect-info`, `/heartbeat`, `/stop` |

## Verification Model

The evidence hash represents the normalized execution record. AgentTrust stores that hash in a Stellar `HashMemo`, submits the signed transaction through Horizon, and persists the resulting transaction hash and ledger metadata.

The public verification endpoint recomputes the evidence fingerprint and checks that:

- The stored run evidence has not changed.
- The Stellar transaction exists on the expected network.
- The transaction memo matches the expected evidence hash.

## Tests and Checks

Run backend tests:

```bash
cd backend
python -m pytest
```

Run frontend quality checks:

```bash
cd frontend
npm run lint
npm run type-check
npm run build
```

## Production Deployment

The recommended production layout is:

- Vercel for the Next.js frontend
- AWS EC2 for Nginx, FastAPI, the sandbox worker, and Docker
- PostgreSQL through Neon, Supabase, or another compatible provider
- Stellar Mainnet for execution-proof anchoring

See [DEPLOYMENT_STAGING.md](DEPLOYMENT_STAGING.md) for the complete deployment and smoke-test procedure.

## Security

- Never commit `backend/.env`, `frontend/.env.local`, or `deploy/.env.production`.
- Never expose Stellar secret keys, JWT secrets, database credentials, SSH keys, or `.pem` files.
- Use a dedicated, minimally funded Stellar account for proof anchoring.
- Review Docker images before allowing them to execute.
- Use HTTPS and narrowly scoped CORS origins in production.
