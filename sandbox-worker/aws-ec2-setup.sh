#!/bin/bash
# Exit immediately if any command exits with a non-zero exit status, treating unset variables as errors
set -euo pipefail

echo "====================================================================="
echo " AGENTTRUST SYSTEM SETUP: INITIALIZING CLOUD COMPUTE ENVIRONMENT     "
echo "====================================================================="

# 1. Update Core System Repositories
echo "--> Step 1: Performing system packages upgrade indexes..."
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Install Mandatory OS Utility Prerequisites
echo "--> Step 2: Injecting system network routing utilities..."
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common \
    rsync \
    gnupg

# 3. Provision Official Docker Engine Repositories Safely
echo "--> Step 3: Registering formal Docker cryptographic GPG keys..."
sudo mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg

echo "--> Step 4: Injecting stable distribution architecture tracking streams..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Core Docker Standalone Daemon Components
echo "--> Step 5: Provisioning Docker containerization runtimes..."
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Lock Down Operating System Firewall Rules
echo "--> Step 6: Engineering local machine security rules and ports..."
if command -v ufw > /dev/null; then
    # Open UFW firewall port 9000 explicitly to receive secure core API traffic
    sudo ufw allow 9000/tcp comment 'AgentTrust Decoupled Sandbox Worker Proxy Port'
    sudo ufw allow 22/tcp comment 'Secure Shell Management Port'
    sudo ufw --force enable || true
    echo "Firewall active. Port 9000 opened."
else
    echo "Warning: Uncomplicated Firewall (UFW) missing. Skipping software rules."
fi

# 6. Build Target Workspace Structures and Normalize User Group Permissions
echo "--> Step 7: Structuring target directories and runtime environments..."
mkdir -p /home/ubuntu/sandbox-worker
sudo mkdir -p /tmp

# Append running user into the local execution group profile to allow socket access without sudo boundaries
if ! groups ubuntu | grep -q docker; then
    sudo usermod -aG docker ubuntu
    echo "Permissions adjusted. Note: Session re-login may be needed to refresh active group flags."
fi

echo "====================================================================="
echo " CONFIGURATION COMPLETE: ENVIRONMENT IS READY FOR PRODUCTION REBUILD "
echo "====================================================================="
