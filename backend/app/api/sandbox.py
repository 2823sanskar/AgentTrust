"""Sandbox worker health and routing diagnostics."""

import httpx
from fastapi import APIRouter

from app.config import settings

router = APIRouter(prefix="/api/sandbox", tags=["sandbox"])


@router.get("/health")
async def sandbox_health():
    if not settings.SANDBOX_WORKER_URL:
        return {
            "status": "fallback",
            "environment": settings.ENVIRONMENT,
            "worker_url": None,
            "mode": "local",
            "detail": "SANDBOX_WORKER_URL is not configured; local Docker fallback is active.",
        }

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{settings.SANDBOX_WORKER_URL}/health")
            response.raise_for_status()
            worker_health = response.json()
    except Exception as exc:
        return {
            "status": "fallback",
            "environment": settings.ENVIRONMENT,
            "worker_url": settings.SANDBOX_WORKER_URL,
            "mode": "local",
            "detail": f"Sandbox worker unreachable: {exc}",
        }

    docker_ready = bool(worker_health.get("docker_daemon_ready", False))
    return {
        "status": "healthy" if docker_ready else "fallback",
        "environment": settings.ENVIRONMENT,
        "worker_url": settings.SANDBOX_WORKER_URL,
        "mode": "cloud" if settings.ENVIRONMENT == "production" and docker_ready else "local",
        "worker": worker_health,
    }
