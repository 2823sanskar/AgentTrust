"""Dynamic port allocation and session-token helpers for desktop sandboxes."""

from __future__ import annotations

import asyncio
import secrets
import socket
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.run import Run

VNC_PORT_RANGE = range(5910, 6000)
WEBSOCKIFY_PORT_RANGE = range(6081, 6181)
ACTIVE_DESKTOP_STATUSES = ("pending", "running")

_port_allocation_lock = asyncio.Lock()
_reserved_vnc_ports: set[int] = set()
_reserved_websockify_ports: set[int] = set()


class NoAvailablePortError(RuntimeError):
    """Raised when no safe VNC/websockify port pair can be reserved."""


def generate_desktop_session_token() -> str:
    """Generate a high-entropy token for VNC/noVNC desktop session access."""
    return secrets.token_urlsafe(32)


def is_port_in_use_socket(port: int, host: str = "0.0.0.0") -> bool:
    """Return True when the OS refuses a local bind for the requested TCP port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind((host, int(port)))
        except OSError:
            return True
    return False


async def get_active_db_ports(db_session: AsyncSession) -> tuple[set[int], set[int]]:
    """Return VNC and websockify ports reserved by active desktop run records."""
    result = await db_session.execute(
        select(Run.vnc_port, Run.websockify_port).where(
            Run.is_interactive.is_(True),
            Run.desktop_status.in_(ACTIVE_DESKTOP_STATUSES),
        )
    )
    vnc_ports: set[int] = set()
    websockify_ports: set[int] = set()

    for vnc_port, websockify_port in result.all():
        if vnc_port is not None:
            vnc_ports.add(int(vnc_port))
        if websockify_port is not None:
            websockify_ports.add(int(websockify_port))

    return vnc_ports, websockify_ports


def _validate_requested_port(
    requested_port: int,
    *,
    allowed_ports: range,
    reserved_ports: set[int],
    label: str,
) -> int:
    port = int(requested_port)
    if port not in allowed_ports:
        raise NoAvailablePortError(
            f"Requested {label} port {port} is outside the allowed range "
            f"{allowed_ports.start}-{allowed_ports.stop - 1}."
        )
    if port in reserved_ports:
        raise NoAvailablePortError(f"Requested {label} port {port} is already reserved.")
    if is_port_in_use_socket(port):
        raise NoAvailablePortError(f"Requested {label} port {port} is already in use.")
    return port


def _first_available_port(
    candidates: Iterable[int],
    *,
    reserved_ports: set[int],
) -> int | None:
    for port in candidates:
        if port in reserved_ports:
            continue
        if not is_port_in_use_socket(port):
            return int(port)
    return None


async def allocate_desktop_ports(
    db_session: AsyncSession,
    requested_vnc: int | None = None,
    requested_websockify: int | None = None,
) -> tuple[int, int]:
    """
    Reserve a VNC/websockify host port pair using both DB and socket availability.

    The reservation becomes durable when the caller stores the selected ports on a
    pending/running Run before starting Docker.
    """
    async with _port_allocation_lock:
        active_vnc_ports, active_websockify_ports = await get_active_db_ports(db_session)
        reserved_vnc_ports = active_vnc_ports | _reserved_vnc_ports
        reserved_websockify_ports = active_websockify_ports | _reserved_websockify_ports

        if requested_vnc is not None:
            selected_vnc = _validate_requested_port(
                requested_vnc,
                allowed_ports=VNC_PORT_RANGE,
                reserved_ports=reserved_vnc_ports,
                label="VNC",
            )
        else:
            selected_vnc = _first_available_port(
                VNC_PORT_RANGE,
                reserved_ports=reserved_vnc_ports,
            )
            if selected_vnc is None:
                raise NoAvailablePortError("No available VNC ports remain.")

        if requested_websockify is not None:
            selected_websockify = _validate_requested_port(
                requested_websockify,
                allowed_ports=WEBSOCKIFY_PORT_RANGE,
                reserved_ports=reserved_websockify_ports,
                label="websockify",
            )
        else:
            selected_websockify = _first_available_port(
                WEBSOCKIFY_PORT_RANGE,
                reserved_ports=reserved_websockify_ports,
            )
            if selected_websockify is None:
                raise NoAvailablePortError("No available websockify ports remain.")

        _reserved_vnc_ports.add(selected_vnc)
        _reserved_websockify_ports.add(selected_websockify)
        return selected_vnc, selected_websockify


async def release_desktop_ports(
    vnc_port: int | None = None,
    websockify_port: int | None = None,
) -> None:
    """Release in-process port reservations after Docker bind or failed startup."""
    async with _port_allocation_lock:
        if vnc_port is not None:
            _reserved_vnc_ports.discard(int(vnc_port))
        if websockify_port is not None:
            _reserved_websockify_ports.discard(int(websockify_port))
