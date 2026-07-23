"""Sandbox worker health and routing diagnostics."""

import httpx
from fastapi import APIRouter

from app.config import settings
from app.services.sandbox import check_sandbox_health

router = APIRouter(prefix="/api/sandbox", tags=["sandbox"])


@router.get("/health")
async def sandbox_health():
    worker_reachable = await check_sandbox_health()
    if worker_reachable:
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                response = await client.get(f"{settings.SANDBOX_WORKER_URL}/health")
                response.raise_for_status()
                worker_health = response.json()
        except Exception as exc:
            return {
                "status": "fallback",
                "environment": settings.ENVIRONMENT,
                "worker_url": settings.SANDBOX_WORKER_URL,
                "mode": "local",
                "stellar_configured": bool(settings.STELLAR_SECRET_KEY and settings.STELLAR_PUBLIC_KEY),
                "detail": f"Sandbox worker unreachable: {exc}",
            }
    else:
        return {
            "status": "fallback",
            "environment": settings.ENVIRONMENT,
            "worker_url": settings.SANDBOX_WORKER_URL,
            "mode": "local",
            "stellar_configured": bool(settings.STELLAR_SECRET_KEY and settings.STELLAR_PUBLIC_KEY),
            "detail": "Sandbox worker unreachable. System operating in local fallback mode.",
        }

    docker_ready = bool(worker_health.get("docker_daemon_ready", False))
    return {
        "status": "healthy" if docker_ready else "fallback",
        "environment": settings.ENVIRONMENT,
        "worker_url": settings.SANDBOX_WORKER_URL,
        "mode": "cloud" if settings.ENVIRONMENT == "production" and docker_ready else "local",
        "stellar_configured": bool(settings.STELLAR_SECRET_KEY and settings.STELLAR_PUBLIC_KEY),
        "worker": worker_health,
    }
