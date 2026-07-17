# AgentTrust External Agent Contract

External agents may be any Docker image. For full structured evidence, they should follow this contract.

## Input

AgentTrust mounts a writable directory at:

```text
/agenttrust
```

The task payload is available at:

```text
$AGENTTRUST_INPUT
```

Example:

```json
{
  "run_id": "uuid",
  "task": "User task text"
}
```

## Output

Contract-compliant agents should write:

```text
$AGENTTRUST_OUTPUT
$AGENTTRUST_ACTION_LOG
```

Example `output.json`:

```json
{
  "status": "success",
  "final_output": "Task completed."
}
```

Example `action_log.json`:

```json
[
  {
    "step": 1,
    "action": "read_task",
    "target": "input.json",
    "status": "success",
    "note": "Task loaded"
  }
]
```

## Arbitrary Agent Fallback

If an external image does not write these files, the worker still captures:

```text
stdout
stderr
exit_code
execution_time
```

It maps stdout/stderr into `final_output` and synthesizes a one-step action log.
