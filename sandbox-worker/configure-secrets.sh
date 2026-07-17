#!/bin/bash
set -euo pipefail

# Pull down the variable configurations from local variables or environment arguments
TARGET_IP="${AWS_EC2_PUBLIC_IP:-}"
KEY_PATH="${AWS_SSH_PRIVATE_KEY_PATH:-$HOME/.ssh/agenttrust-staging-key.pem}"

echo "====================================================================="
echo "        AGENTTRUST SECURITY: SYNCING PRODUCTION CLOUD SECRETS       "
echo "====================================================================="

if [ -z "$TARGET_IP" ]; then
    echo "[X] ERROR: AWS_EC2_PUBLIC_IP environment variable is missing."
    echo "    Usage: AWS_EC2_PUBLIC_IP='1.2.3.4' ./configure-secrets.sh"
    exit 1
fi

if [ ! -f "$KEY_PATH" ]; then
    echo "[X] ERROR: SSH private key file not found at $KEY_PATH"
    echo "    Set AWS_SSH_PRIVATE_KEY_PATH or move your .pem file to ~/.ssh/agenttrust-staging-key.pem"
    exit 1
fi

chmod 600 "$KEY_PATH" || true

echo "[*] Compiling isolated production secret parameters..."

# Construct the raw production values directly in memory
cat << EOF > .env.production.local
# --- Automated Production Environment Configuration ---
ENVIRONMENT=production
HOST_TMP_DIR=/tmp
PORT=9000
PYTHONUNBUFFERED=1
EOF

echo "[*] Streaming encrypted payload over secure SSH tunnel to AWS..."
# Inject the environment file directly to the home workspace folder on the remote cloud host
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no .env.production.local ubuntu@"$TARGET_IP":/home/ubuntu/sandbox-worker/.env

echo "[*] Cleaning up temporary local memory footprints..."
rm .env.production.local

echo "====================================================================="
echo " [OK] SUCCESS: SECRETS SECURELY DEPLOYED ON REMOTE AWS MACHINE        "
echo "====================================================================="
