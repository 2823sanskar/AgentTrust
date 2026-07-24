"""Final AgentTrust deployment smoke test.

This script validates:
1. Frontend visibility.
2. Backend cloud-worker health.
3. Authenticated end-to-end execution through AgentTrust into the AWS sandbox.
4. Database telemetry retrieval for the saved run.

Required environment:
  AGENTTRUST_ACCESS_TOKEN

Or:
  AGENTTRUST_EMAIL
  AGENTTRUST_PASSWORD

Optional environment:
  AGENTTRUST_FRONTEND_URL=http://127.0.0.1:3000
  AGENTTRUST_BACKEND_URL=http://127.0.0.1:8000
  AGENTTRUST_AGENT_ID=<existing external_docker agent id>
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
from typing import Any

import httpx


FRONTEND_URL = os.getenv("AGENTTRUST_FRONTEND_URL", "http://127.0.0.1:3000").rstrip("/")
BACKEND_URL = os.getenv("AGENTTRUST_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
ACCESS_TOKEN = os.getenv("AGENTTRUST_ACCESS_TOKEN")
EMAIL = os.getenv("AGENTTRUST_EMAIL")
PASSWORD = os.getenv("AGENTTRUST_PASSWORD")
AGENT_ID = os.getenv("AGENTTRUST_AGENT_ID")
CONFIGURED_STELLAR_NETWORK = os.getenv("STELLAR_NETWORK", "mainnet").strip().lower()
if CONFIGURED_STELLAR_NETWORK not in {"mainnet", "public", "pubnet"}:
    raise SystemExit(
        "AgentTrust production verification is Mainnet-only. "
        "Set STELLAR_NETWORK=mainnet."
    )
STELLAR_NETWORK = "mainnet"
STELLAR_NETWORK_LABEL = "Mainnet"
STELLAR_EXPLORER_NETWORK = "public"

SMOKE_COMMAND = (
    "python -c \"import pathlib,urllib.request; "
    "pathlib.Path('/probe.txt').write_text('rw-ok'); "
    "print(urllib.request.urlopen('http://example.com', timeout=10).status); "
    "print(pathlib.Path('/probe.txt').read_text())\""
)

SMOKE_TASK = (
    "Final deployment smoke test: verify AWS cloud sandbox routing, outbound "
    "network access, writable container filesystem, telemetry persistence, and "
    "dashboard routing badge metadata."
)


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    sys.exit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


async def request_json(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    json: dict[str, Any] | None = None,
    expected: set[int] | None = None,
) -> dict[str, Any]:
    expected = expected or {200}
    response = await client.request(method, url, headers=headers, json=json)
    if response.status_code not in expected:
        body = response.text[:1000]
        fail(f"{method} {url} returned HTTP {response.status_code}: {body}")
    return response.json()


async def get_token(client: httpx.AsyncClient) -> str:
    if ACCESS_TOKEN:
        ok("Using AGENTTRUST_ACCESS_TOKEN.")
        return ACCESS_TOKEN

    if not EMAIL or not PASSWORD:
        fail(
            "Set AGENTTRUST_ACCESS_TOKEN, or set AGENTTRUST_EMAIL and "
            "AGENTTRUST_PASSWORD before running this script."
        )

    data = await request_json(
        client,
        "POST",
        f"{BACKEND_URL}/api/login",
        json={"email": EMAIL, "password": PASSWORD},
    )
    token = data.get("access_token")
    if not token:
        fail("Login succeeded but no access_token was returned.")
    ok("Authenticated with backend.")
    return str(token)


async def ensure_smoke_agent(
    client: httpx.AsyncClient,
    headers: dict[str, str],
) -> str:
    if AGENT_ID:
        ok(f"Using AGENTTRUST_AGENT_ID={AGENT_ID}.")
        return AGENT_ID

    agents = await request_json(client, "GET", f"{BACKEND_URL}/api/agents?page_size=50")
    for agent in agents.get("agents", []):
        if (
            agent.get("provider") == "external_docker"
            and agent.get("docker_image") == "python:3.12-slim"
            and agent.get("docker_command") == SMOKE_COMMAND
        ):
            ok(f"Reusing smoke-test agent {agent.get('id')}.")
            return str(agent["id"])

    created = await request_json(
        client,
        "POST",
        f"{BACKEND_URL}/api/agents",
        headers=headers,
        expected={201},
        json={
            "name": f"deployment smoke agent {int(time.time())}",
            "description": "Temporary high-freedom deployment smoke-test agent.",
            "provider": "external_docker",
            "model": "python-docker-smoke",
            "system_prompt": "Run a deployment smoke test inside Docker.",
            "docker_image": "python:3.12-slim",
            "docker_command": SMOKE_COMMAND,
            "timeout_seconds": 60,
            "category": "deployment",
        },
    )
    ok(f"Created smoke-test agent {created.get('id')}.")
    return str(created["id"])


async def verify_frontend(client: httpx.AsyncClient) -> None:
    print("\nTask 1: Verifying frontend visibility...")
    response = await client.get(f"{FRONTEND_URL}/dashboard")
    if response.status_code != 200:
        fail(f"Frontend dashboard returned HTTP {response.status_code}.")
    ok(f"Frontend dashboard reachable at {FRONTEND_URL}/dashboard.")


async def verify_worker_health(client: httpx.AsyncClient) -> None:
    print("\nTask 2: Verifying backend cloud worker health...")
    app_health = await request_json(client, "GET", f"{BACKEND_URL}/api/health")
    backend_stellar_network = str(app_health.get("stellar_network") or "").lower()
    if backend_stellar_network != STELLAR_NETWORK:
        fail(
            "Backend Stellar network does not match this deployment check: "
            f"expected={STELLAR_NETWORK!r}, actual={backend_stellar_network!r}."
        )
    if not app_health.get("stellar_configured"):
        fail("Backend Mainnet keypair is not configured.")
    if not app_health.get("stellar_ready"):
        fail("Backend did not complete its Stellar Mainnet startup check.")

    health = await request_json(client, "GET", f"{BACKEND_URL}/api/sandbox/health")
    if health.get("mode") != "cloud":
        fail(f"Expected backend cloud mode, got {health.get('mode')!r}.")

    worker = health.get("worker") or {}
    if worker.get("network_mode") != "bridge" or worker.get("read_only_root") is not False:
        fail(
            "Worker is reachable, but behavioral profile is not active: "
            f"network_mode={worker.get('network_mode')}, "
            f"read_only_root={worker.get('read_only_root')}"
        )
    ok(
        "AWS worker is healthy with high-freedom behavioral profile "
        f"and Stellar {STELLAR_NETWORK_LABEL} configuration."
    )


async def execute_and_verify(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    agent_id: str,
) -> None:
    print("\nTask 3: Executing high-freedom sandbox payload through AgentTrust...")
    run = await request_json(
        client,
        "POST",
        f"{BACKEND_URL}/api/execute",
        headers=headers,
        expected={201},
        json={"agent_id": agent_id, "task": SMOKE_TASK},
    )
    run_id = run.get("id")
    if not run_id:
        fail("Execute response did not include a run id.")
    ok(f"Execution saved as run {run_id}.")

    print("\nTask 4: Verifying persisted telemetry...")
    stored = await request_json(client, "GET", f"{BACKEND_URL}/api/runs/{run_id}")

    routing_mode = stored.get("routing_mode")
    exit_code = stored.get("exit_code")
    stellar_tx = stored.get("stellar_transaction")
    stdout = stored.get("container_stdout") or ""
    action_log = stored.get("action_log") or []
    action_blob = " ".join(
        f"{entry.get('action', '')} {entry.get('note', '')}"
        for entry in action_log
        if isinstance(entry, dict)
    )

    if routing_mode != "cloud_sandbox":
        fail(f"Expected routing_mode=cloud_sandbox, got {routing_mode!r}.")
    if exit_code != 0:
        fail(f"Expected exit_code=0, got {exit_code!r}. stderr={stored.get('container_stderr')!r}")
    if "200" not in stdout or "rw-ok" not in stdout:
        fail(f"Expected internet/write output signature in stdout, got {stdout!r}.")
    if "Behavioral evaluation profile active" not in action_blob:
        fail("Behavioral profile telemetry marker was not persisted in action_log.")
    if not stored.get("hash"):
        fail("Run hash was not persisted.")
    if not stellar_tx:
        fail("Run was saved, but stellar_transaction is missing.")
    if stored.get("stellar_network") != STELLAR_NETWORK:
        fail(
            "Run was not recorded as a Stellar Mainnet anchor: "
            f"{stored.get('stellar_network')!r}."
        )

    receipt = await request_json(
        client,
        "GET",
        f"{BACKEND_URL}/api/verify/{run_id}",
    )
    if not receipt.get("stellar_verified") or not receipt.get("hashes_match"):
        fail(f"Public verification did not validate the Mainnet receipt: {receipt!r}")
    explorer_url = str(receipt.get("explorer_url") or "")
    if "/explorer/public/tx/" not in explorer_url:
        fail(f"Verification returned a non-Mainnet explorer URL: {explorer_url!r}")

    ok(f"Telemetry and Stellar {STELLAR_NETWORK_LABEL} anchor verified.")
    print(
        "\nALL CHECKS PASSED. Deployment is operational on "
        f"Stellar {STELLAR_NETWORK_LABEL}."
    )
    print(f"Run ID: {run_id}")
    print(f"Routing: {routing_mode}")
    print(f"Stellar {STELLAR_NETWORK_LABEL} Tx: {stellar_tx}")
    print(
        "Verification URL: "
        f"https://stellar.expert/explorer/{STELLAR_EXPLORER_NETWORK}/tx/{stellar_tx}"
    )
    print(f"Output: {stdout.strip()}")


async def run_production_smoke_test() -> None:
    print("STARTING FINAL AGENTTRUST DEPLOYMENT CHECKLIST")
    print(f"Frontend: {FRONTEND_URL}")
    print(f"Backend:  {BACKEND_URL}")

    async with httpx.AsyncClient(timeout=120.0) as client:
        await verify_frontend(client)
        await verify_worker_health(client)
        token = await get_token(client)
        headers = {"Authorization": f"Bearer {token}"}
        agent_id = await ensure_smoke_agent(client, headers)
        await execute_and_verify(client, headers, agent_id)


if __name__ == "__main__":
    asyncio.run(run_production_smoke_test())
