# AgentTrust Public Staging Deployment

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

Stellar Testnet
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
STELLAR_SECRET_KEY=your_stellar_testnet_secret_key
STELLAR_PUBLIC_KEY=your_stellar_testnet_public_key
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
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
backend\.venv\Scripts\python.exe verify_deployment.py
```

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
