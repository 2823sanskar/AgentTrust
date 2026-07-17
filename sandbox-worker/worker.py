"""Standalone AgentTrust sandbox worker.

Run this service inside WSL2, a local Ubuntu VM, or a future AWS EC2 node.
The main AgentTrust backend talks to this service over HTTP and never touches
the host Docker daemon directly when SANDBOX_WORKER_URL is configured.
"""

import asyncio
import json
import os
import shlex
import tempfile
import time
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

MAX_CAPTURE_CHARS = 20000
MAX_MEMORY = "256m"
MAX_MEMORY_BYTES = 256 * 1024 * 1024
MAX_CPUS = "0.5"
MAX_PIDS = "50"
NETWORK_MODE = "bridge"
READ_ONLY_ROOT = False

# AWS Staging/Production Host Directory Path Fallback
HOST_TMP_DIR = os.getenv("HOST_TMP_DIR", None)

IGNORED_COMMAND_OVERRIDES = {
    "",
    "leave",
    "leave empty",
    "blank",
    "empty",
    "none",
    "null",
    "n/a",
    "default",
    "image cmd",
    "use image cmd",
    "leave blank",
    "leave blank to use the image cmd",
}

app = FastAPI(title="AgentTrust Sandbox Worker", version="0.1.0")


class RunRequest(BaseModel):
    run_id: str = Field(..., min_length=1)
    agent_image: str = Field(..., min_length=1)
    docker_command: str | None = None
    task: str
    timeout_seconds: int = Field(60, ge=1, le=600)


class ActionLogEntry(BaseModel):
    step: int
    action: str
    target: str
    status: Literal["success", "failure"]
    note: str = ""


class RunResponse(BaseModel):
    status: Literal["success", "failure"]
    stdout: str
    stderr: str
    exit_code: int | None
    execution_time: float
    final_output: str
    action_log: list[ActionLogEntry]


def truncate(value: str) -> str:
    if len(value) <= MAX_CAPTURE_CHARS:
        return value
    return value[:MAX_CAPTURE_CHARS] + "\n...[truncated]"


def normalize_command(value: str | None) -> str | None:
    if value is None:
        return None
    command = value.strip()
    if command.lower() in IGNORED_COMMAND_OVERRIDES:
        return None
    return command


def read_json(path: Path) -> Any | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def normalize_action_log(value: Any) -> list[ActionLogEntry]:
    if not isinstance(value, list):
        return []

    entries: list[ActionLogEntry] = []
    for index, item in enumerate(value, start=1):
        if isinstance(item, dict):
            status = str(item.get("status") or "success").lower()
            entries.append(
                ActionLogEntry(
                    step=int(item.get("step") or index),
                    action=str(item.get("action") or "Agent action"),
                    target=str(item.get("target") or "external_agent"),
                    status="failure" if status == "failure" else "success",
                    note=str(item.get("note") or ""),
                )
            )
        else:
            entries.append(
                ActionLogEntry(
                    step=index,
                    action="Agent action",
                    target="external_agent",
                    status="success",
                    note=str(item),
                )
            )
    return entries


def synthesize_fallback_action(
    image: str,
    exit_code: int | None,
    stdout: str,
    stderr: str,
    execution_time: float,
) -> ActionLogEntry:
    return ActionLogEntry(
        step=1,
        action="Captured arbitrary container output",
        target=image,
        status="success" if exit_code == 0 else "failure",
        note=(
            f"exit_code={exit_code}, duration={execution_time:.2f}s, "
            f"stdout_chars={len(stdout)}, stderr_chars={len(stderr)}"
        ),
    )


@app.get("/health")
async def health() -> dict[str, Any]:
    docker_cli_ready = False
    docker_daemon_ready = False
    docker_error = ""

    try:
        process = await asyncio.create_subprocess_exec(
            "docker",
            "version",
            "--format",
            "{{json .Server.Version}}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=5)
        docker_cli_ready = process.returncode != 127
        docker_daemon_ready = process.returncode == 0
        if process.returncode != 0:
            docker_error = stderr_bytes.decode("utf-8", errors="replace").strip()
    except Exception as exc:
        docker_error = str(exc)

    return {
        "status": "ok" if docker_daemon_ready else "degraded",
        "worker": "agenttrust-sandbox-worker",
        "docker_cli_ready": docker_cli_ready,
        "docker_daemon_ready": docker_daemon_ready,
        "docker_error": docker_error,
        "host_tmp_dir": HOST_TMP_DIR,
        "container_tmp_dir": tempfile.gettempdir(),
        "storage_opt": "size=1g",
        "memory_limit": MAX_MEMORY,
        "memory_swap_limit": MAX_MEMORY,
        "cpus": MAX_CPUS,
        "pids_limit": MAX_PIDS,
        "network_mode": NETWORK_MODE,
        "read_only_root": READ_ONLY_ROOT,
        "behavioral_profile": "high_trust_rw_internet",
    }


def host_mount_path(run_dir: Path) -> Path:
    if not HOST_TMP_DIR:
        return run_dir
    return Path(HOST_TMP_DIR) / run_dir.name


@app.post("/run", response_model=RunResponse)
async def run_agent(request: RunRequest) -> RunResponse:
    start_time = time.time()
    stdout = ""
    stderr = ""
    exit_code: int | None = None

    with tempfile.TemporaryDirectory(prefix=f"agenttrust-worker-{request.run_id}-") as temp_dir:
        run_dir = Path(temp_dir)
        input_path = run_dir / "input.json"
        output_path = run_dir / "output.json"
        action_log_path = run_dir / "action_log.json"
        mount_source = host_mount_path(run_dir)

        input_path.write_text(
            json.dumps({"run_id": request.run_id, "task": request.task}, ensure_ascii=False),
            encoding="utf-8",
        )

        command = [
            "docker",
            "run",
            "--rm",
            "--network",
            NETWORK_MODE,
            "--cpus",
            MAX_CPUS,
            "--memory",
            MAX_MEMORY,
            "--memory-swap",
            MAX_MEMORY,
            "--pids-limit",
            MAX_PIDS,
            "--storage-opt",
            "size=1g",
            "-v",
            f"{mount_source}:/agenttrust:rw",
            "-e",
            "AGENTTRUST_INPUT=/agenttrust/input.json",
            "-e",
            "AGENTTRUST_OUTPUT=/agenttrust/output.json",
            "-e",
            "AGENTTRUST_ACTION_LOG=/agenttrust/action_log.json",
            "-e",
            f"AGENTTRUST_RUN_ID={request.run_id}",
            request.agent_image,
        ]

        docker_command = normalize_command(request.docker_command)
        if docker_command:
            command.extend(shlex.split(docker_command))

        timed_out = False
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    process.communicate(),
                    timeout=request.timeout_seconds,
                )
            except asyncio.TimeoutError:
                timed_out = True
                process.kill()
                stdout_bytes, stderr_bytes = await process.communicate()

            stdout = truncate(stdout_bytes.decode("utf-8", errors="replace"))
            stderr = truncate(stderr_bytes.decode("utf-8", errors="replace"))
            exit_code = process.returncode
        except Exception as exc:
            stderr = truncate(str(exc))
            exit_code = 127

        execution_time = round(time.time() - start_time, 4)
        output_json = read_json(output_path)
        action_json = read_json(action_log_path)

        final_output = ""
        contract_status: str | None = None
        if isinstance(output_json, dict):
            final_output = str(
                output_json.get("final_output")
                or output_json.get("output")
                or output_json.get("response")
                or ""
            )
            raw_status = output_json.get("status")
            contract_status = str(raw_status).lower() if raw_status is not None else None

        if not final_output:
            final_output = stdout.strip() or stderr.strip() or "External agent produced no output."

        action_log = normalize_action_log(action_json)
        if not action_log:
            action_log = [
                synthesize_fallback_action(
                    request.agent_image,
                    exit_code,
                    stdout,
                    stderr,
                    execution_time,
                )
            ]
        action_log.insert(
            0,
            ActionLogEntry(
                step=1,
                action="Behavioral evaluation profile active",
                target="docker_runtime",
                status="success",
                note=(
                    f"network_mode={NETWORK_MODE}, read_only_root=false, "
                    f"memory={MAX_MEMORY}, cpus={MAX_CPUS}, pids_limit={MAX_PIDS}, storage_opt=size=1g"
                ),
            ),
        )
        for index, entry in enumerate(action_log, start=1):
            entry.step = index

        if stderr:
            action_log.append(
                ActionLogEntry(
                    step=len(action_log) + 1,
                    action="Captured stderr",
                    target="container_stderr",
                    status="failure" if exit_code else "success",
                    note=stderr,
                )
            )

        status: Literal["success", "failure"] = "success"
        if timed_out:
            status = "failure"
            final_output = f"Sandbox worker timed out after {request.timeout_seconds}s."
            exit_code = exit_code if exit_code is not None else 124
        elif exit_code == 137:
            status = "failure"
            final_output = (
                "CRITICAL ERROR: Resource isolation boundary triggered. "
                f"The sandbox agent container exceeded its allocated memory limit ({MAX_MEMORY}) "
                "or was forcefully terminated by the runtime manager."
            )
        elif exit_code != 0:
            status = "failure"
        elif contract_status and contract_status not in {"success", "ok", "completed"}:
            status = "failure"

        return RunResponse(
            status=status,
            stdout=stdout,
            stderr=stderr,
            exit_code=exit_code,
            execution_time=execution_time,
            final_output=final_output,
            action_log=action_log,
        )
