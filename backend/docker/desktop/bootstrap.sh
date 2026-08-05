#!/bin/bash
set -e

CONFIG_FILE="/agenttrust/agent_config.json"

echo "[AGENTTRUST] Initializing sandbox desktop execution environment..."

if [ -f "$CONFIG_FILE" ]; then
    INSTALL_CMD=$(jq -r '.install_cmd // empty' "$CONFIG_FILE")
    EXEC_CMD=$(jq -r '.exec_cmd // empty' "$CONFIG_FILE")
    TASK_PROMPT=$(jq -r '.task // empty' "$CONFIG_FILE")

    if [ -n "$INSTALL_CMD" ]; then
        echo "[AGENTTRUST] Executing auto-install command: $INSTALL_CMD"
        eval "$INSTALL_CMD"
    fi

    if [ -n "$EXEC_CMD" ]; then
        # Replace {task} placeholder with the actual task prompt
        FINAL_EXEC_CMD="${EXEC_CMD//\{task\}/$TASK_PROMPT}"
        echo "[AGENTTRUST] Executing agent entrypoint: $FINAL_EXEC_CMD"
        eval "$FINAL_EXEC_CMD"
    fi
else
    echo "[AGENTTRUST] Standard desktop sandbox mode (no custom agent config provided)."
fi
