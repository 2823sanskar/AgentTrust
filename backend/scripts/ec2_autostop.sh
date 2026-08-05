#!/bin/bash
# /usr/local/bin/ec2_autostop.sh
# AgentTrust EC2 Auto-Shutdown Script to prevent runaway AWS credit consumption.

IDLE_FILE="/tmp/agenttrust_idle_counter"
MAX_IDLE_MINUTES=30

# Check if docker containers are running active agent tasks
ACTIVE_CONTAINERS=$(docker ps -q --filter "name=agenttrust-desktop")

if [ -z "$ACTIVE_CONTAINERS" ]; then
    if [ -f "$IDLE_FILE" ]; then
        IDLE_COUNT=$(cat "$IDLE_FILE")
        IDLE_COUNT=$((IDLE_COUNT + 5))
    else
        IDLE_COUNT=5
    fi
    echo "$IDLE_COUNT" > "$IDLE_FILE"
    echo "[AUTOSTOP] Sandbox idle for $IDLE_COUNT minutes."

    if [ "$IDLE_COUNT" -ge "$MAX_IDLE_MINUTES" ]; then
        echo "[AUTOSTOP] Idle threshold reached ($MAX_IDLE_MINUTES min). Powering down EC2 instance."
        rm -f "$IDLE_FILE"
        sudo shutdown -h now
    fi
else
    # Reset counter if active tasks exist
    rm -f "$IDLE_FILE"
    echo "[AUTOSTOP] Active container execution detected. Idle counter reset."
fi
