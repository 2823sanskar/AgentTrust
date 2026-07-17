# clawbot-demo

Demo external Docker agent for the AgentTrust sandbox MVP.

Build it locally:

```bash
docker build -t clawbot-demo:latest .
```

Register an AgentTrust agent with:

- Provider/type: `external_docker`
- Docker image: `clawbot-demo:latest`
- Run command: leave blank
- Timeout seconds: `60`

The container reads task input from `AGENTTRUST_INPUT` or `/agenttrust/input.json`.
It writes:

- `AGENTTRUST_OUTPUT` or `/agenttrust/output.json`
- `AGENTTRUST_ACTION_LOG` or `/agenttrust/action_log.json`

Input format:

```json
{
  "run_id": "uuid",
  "task": "User task here"
}
```

Output format:

```json
{
  "run_id": "uuid",
  "status": "success",
  "final_output": "Human-readable final output"
}
```
