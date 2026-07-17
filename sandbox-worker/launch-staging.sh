#!/bin/bash
set -euo pipefail

TARGET_IP="${AWS_EC2_PUBLIC_IP:-}"
KEY_PATH="${AWS_SSH_PRIVATE_KEY_PATH:-$HOME/.ssh/agenttrust-staging-key.pem}"

echo "====================================================================="
echo "        AGENTTRUST DEPLOYMENT: RUNNING CLOUD IGNITION ENGINE        "
echo "====================================================================="

if [ -z "$TARGET_IP" ]; then
    echo "[X] ERROR: AWS_EC2_PUBLIC_IP environment variable is missing."
    echo "    Usage: AWS_EC2_PUBLIC_IP='1.2.3.4' ./launch-staging.sh"
    exit 1
fi

if [ ! -f "$KEY_PATH" ]; then
    echo "[X] ERROR: SSH private key file not found at $KEY_PATH"
    echo "    Set AWS_SSH_PRIVATE_KEY_PATH or move your .pem file to ~/.ssh/agenttrust-staging-key.pem"
    exit 1
fi

chmod 600 "$KEY_PATH" || true
SSH_OPTS=(-i "$KEY_PATH" -o StrictHostKeyChecking=no)

# 1. Trigger Cloud Virtual Machine Environment Architecture Setup
echo "[*] Initializing remote machine software components and Docker tools..."
ssh "${SSH_OPTS[@]}" ubuntu@"$TARGET_IP" "bash -s" < ./aws-ec2-setup.sh

# 2. Inject Zero-Git Secure Configuration Variables
echo "[*] Transferring secure environment profile secrets..."
AWS_EC2_PUBLIC_IP="$TARGET_IP" AWS_SSH_PRIVATE_KEY_PATH="$KEY_PATH" ./configure-secrets.sh

# 3. Sync Worker Runtime Files Without Git
echo "[*] Syncing sandbox worker runtime files to remote host..."
tar \
    --exclude='.venv' \
    --exclude='__pycache__' \
    --exclude='*.log' \
    --exclude='.env' \
    --exclude='.env.production.local' \
    -czf - . | ssh "${SSH_OPTS[@]}" ubuntu@"$TARGET_IP" "
        mkdir -p /home/ubuntu/sandbox-worker &&
        tar -xzf - -C /home/ubuntu/sandbox-worker &&
        chmod +x /home/ubuntu/sandbox-worker/*.sh || true
    "

# 4. Trigger Remote Docker Compose Cluster Build
echo "[*] Building active containers and starting Nginx gateway..."
ssh "${SSH_OPTS[@]}" ubuntu@"$TARGET_IP" "
    cd /home/ubuntu/sandbox-worker &&
    if [ -f .env ]; then
        echo '--> Loading structural secrets...';
    else
        echo 'WARN: No explicit secret profile found.';
    fi
    sudo docker compose -f compose.staging.yml down --remove-orphans
    sudo docker compose -f compose.staging.yml up -d --build
"

echo "====================================================================="
echo " [OK] SUCCESS: LIVE STAGING INSTANCE IS OPERATIONAL ON AWS           "
echo "====================================================================="
