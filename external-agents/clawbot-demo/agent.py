"""Clawbot demo external agent for the AgentTrust Docker sandbox MVP."""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


def read_task() -> dict:
    input_path = os.getenv("AGENTTRUST_INPUT", "/agenttrust/input.json")
    if Path(input_path).exists():
        return json.loads(Path(input_path).read_text(encoding="utf-8"))

    return {
        "run_id": os.getenv("AGENTTRUST_RUN_ID", "unknown"),
        "task": os.getenv("AGENTTRUST_TASK", ""),
    }


def write_json(path_value: str, payload: object) -> None:
    path = Path(path_value)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def summarize(task: str) -> str:
    words = re.findall(r"[A-Za-z0-9']+", task)
    unique_words = sorted({word.lower() for word in words if len(word) > 3})
    top_terms = ", ".join(unique_words[:6]) or "none"
    return (
        "Clawbot demo completed the task inside Docker.\n\n"
        f"Task length: {len(task)} characters\n"
        f"Detected terms: {top_terms}\n\n"
        "MVP result: the agent received structured input, produced structured output, "
        "and emitted an auditable action log for AgentTrust hashing and Stellar anchoring."
    )


def main() -> int:
    started_at = datetime.now(timezone.utc).isoformat()
    payload = read_task()
    run_id = str(payload.get("run_id", "unknown"))
    task = str(payload.get("task", ""))

    actions = [
        {
            "step": 1,
            "action": "Read structured task input",
            "target": os.getenv("AGENTTRUST_INPUT", "/agenttrust/input.json"),
            "status": "success",
            "note": f"run_id={run_id}",
        },
        {
            "step": 2,
            "action": "Analyzed task text",
            "target": "task",
            "status": "success",
            "note": f"characters={len(task)}",
        },
        {
            "step": 3,
            "action": "Generated final output",
            "target": os.getenv("AGENTTRUST_OUTPUT", "/agenttrust/output.json"),
            "status": "success",
            "note": "Demo response written using the AgentTrust contract",
        },
    ]

    final_output = summarize(task)
    output = {
        "run_id": run_id,
        "status": "success",
        "final_output": final_output,
        "started_at": started_at,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }

    write_json(os.getenv("AGENTTRUST_OUTPUT", "/agenttrust/output.json"), output)
    write_json(os.getenv("AGENTTRUST_ACTION_LOG", "/agenttrust/action_log.json"), actions)
    print(f"clawbot-demo completed run {run_id}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"clawbot-demo failed: {exc}", file=sys.stderr)
        raise
