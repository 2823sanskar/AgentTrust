# AgentTrust Public Deployment

This deployment keeps the Docker sandbox on EC2 where it can access a real Docker daemon.

Target architecture:

```text
Vercel
  -> Next.js frontend

AWS EC2
  -> Nginx on port 80
  -> FastAPI backend
  -> sandbox-worker
  -> host Docker daemon for external agents

Neon
  -> Postgres database

Stellar Mainnet
  -> execution hash anchoring
```

Do not deploy `sandbox-worker` to Vercel, Render, Railway, or serverless infrastructure.

---

## 1. Neon Postgres

Create a Neon project and copy the connection string.

Use SQLAlchemy async format:

```text
postgresql+asyncpg://USER:PASSWORD@HOST.neon.tech/DBNAME?ssl=require
```

This becomes `DATABASE_URL`.

---

## 2. EC2 Backend + Worker

On EC2, place the repo at `/home/ubuntu/AgentTrust` or any stable path.

Create the production env file:

```bash
cd /home/ubuntu/AgentTrust
cp deploy/.env.production.example deploy/.env.production
nano deploy/.env.production
```

Required values:

```bash
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST.neon.tech/DBNAME?ssl=require
JWT_SECRET=replace-with-a-long-random-secret
STELLAR_SECRET_KEY=your_funded_stellar_mainnet_secret_key
STELLAR_PUBLIC_KEY=GCPICED67VZ2VUESHTKMXZMWJJVSV4ZFULILSUQJS2GL77KBRHILDIN3
STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_MAX_BASE_FEE=10000
ENVIRONMENT=production
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://your-vercel-app.vercel.app,http://YOUR_EC2_PUBLIC_IP
```

Start the stack:

```bash
docker compose -f deploy/compose.production.yml up -d --build
```

Health checks:

```bash
curl http://YOUR_EC2_PUBLIC_IP/health
curl http://YOUR_EC2_PUBLIC_IP/api/sandbox/health
curl http://YOUR_EC2_PUBLIC_IP/sandbox/health
```

Expected:

- backend status is `healthy`
- `stellar_configured` is `true`
- `stellar_ready` is `true`
- `stellar_network` is `mainnet`
- sandbox `mode` is `cloud`
- worker Docker daemon is ready
- worker profile shows `network_mode=bridge`

The worker `/run` endpoint is not exposed through Nginx. Agent execution must go through the backend `/api/execute` route.

---

## 3. Vercel Frontend

Create a Vercel project from the `frontend/` directory.

Set this Vercel environment variable:

```bash
NEXT_PUBLIC_API_URL=http://YOUR_EC2_PUBLIC_IP/api
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
```

Deploy the frontend.

Then add the final Vercel URL to EC2 `deploy/.env.production`:

```bash
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://your-vercel-app.vercel.app,http://YOUR_EC2_PUBLIC_IP
```

Restart the backend:

```bash
docker compose -f deploy/compose.production.yml up -d --build backend nginx
```

---

## 4. Final Verification

From your local machine:

```powershell
$env:AGENTTRUST_FRONTEND_URL="https://your-vercel-app.vercel.app"
$env:AGENTTRUST_BACKEND_URL="http://YOUR_EC2_PUBLIC_IP"
$env:AGENTTRUST_ACCESS_TOKEN="your-jwt-token"
$env:STELLAR_NETWORK="mainnet"
backend\.venv\Scripts\python.exe verify_deployment.py
```

The backend now fails startup in production if the keypair is invalid, the
public and secret keys do not match, the account does not exist on Mainnet, or
the configured Horizon endpoint reports a non-Mainnet network passphrase.
Do not overwrite the complete EC2 environment file when switching networks;
edit only the five `STELLAR_*` values so database, JWT, PgBouncer, and worker
configuration remains intact.

Existing wallet links recorded as Testnet are hidden from the active user
profile and excluded from new runs until the user reconnects Freighter while it
is set to Mainnet. Historical run snapshots and Testnet receipts remain
read-only and verifiable.

The production backend runs one async Uvicorn worker so all transactions from
the shared anchor account are serialized safely. Scale the sandbox worker
independently; adding backend process workers requires Stellar channel accounts
or a distributed transaction-submission queue.

The script must confirm:

- frontend loads
- backend routes to cloud worker
- AWS worker can run Docker
- execution creates a DB run
- `routing_mode=cloud_sandbox`
- execution hash exists
- `stellar_transaction` exists
- verification URL is printed

---

## 5. Secret Rules

Never commit:

- `backend/.env`
- `frontend/.env.local`
- `deploy/.env.production`
- SSH keys or `.pem` files

Use GitHub/Vercel secrets for anything private.
