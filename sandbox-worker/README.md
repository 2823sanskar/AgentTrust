# AgentTrust Sandbox Worker

Standalone sandbox service for running external Docker agents from a local VM, WSL2 Ubuntu, or future AWS EC2 node.

## Run Locally

```bash
cd sandbox-worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn worker:app --host 0.0.0.0 --port 9000
```

Health check:

```bash
curl http://127.0.0.1:9000/health
```

## AgentTrust Backend Config

Set this in `backend/.env`:

```text
SANDBOX_WORKER_URL=http://127.0.0.1:9000
```

When set, AgentTrust forwards `external_docker` executions to this worker. When unset, AgentTrust falls back to its local Docker runner.

## Execution Contract

The backend calls:

```http
POST /run
```

Payload:

```json
{
  "run_id": "uuid",
  "agent_image": "external-agent:latest",
  "docker_command": null,
  "task": "User task",
  "timeout_seconds": 60
}
```

The worker runs Docker with:

```text
--rm
--network none
--cpus 1
--memory 256m
```

Response includes:

```text
status
stdout
stderr
exit_code
execution_time
final_output
action_log
```

See `agent_contract.md` for external agent behavior.
