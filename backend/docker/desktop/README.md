# AgentTrust Interactive Desktop Sandbox & EC2 Production Guide

This directory contains the Dockerfile, entrypoint script, and auto-installer bootstrap scripts for the **AgentTrust Interactive Desktop Sandbox Environment**.

---

## 🛠️ Components

1. **`Dockerfile`**: Ubuntu 22.04 LTS container image with XFCE4 desktop, Python 3.11, Node.js 20, Docker-in-Docker capability, `jq`, `websockify`, and `x11vnc`.
2. **`entrypoint.sh`**: Initializes display `:1`, starts Xvfb, XFCE4 desktop session, x11vnc, and websockify bridge.
3. **`bootstrap.sh`**: Auto-installer bootstrap script placed in `/agenttrust/bootstrap.sh`. Reads `/agenttrust/agent_config.json`, executes `install_cmd` (e.g. `pip install openclaw`), substitutes user task prompts into `exec_cmd`, and streams logs.

---

## ⏱️ EC2 Auto-Shutdown & Idle Timeout Safeguard

To prevent accidental credit consumption when the EC2 instance is idle:

### 1. Install `ec2_autostop.sh`
Copy `backend/scripts/ec2_autostop.sh` to `/usr/local/bin/ec2_autostop.sh` on the EC2 host:
```bash
sudo cp backend/scripts/ec2_autostop.sh /usr/local/bin/ec2_autostop.sh
sudo chmod +x /usr/local/bin/ec2_autostop.sh
```

### 2. Configure System Cron Job
Add the following cron entry (`sudo crontab -e`):
```cron
# Run autostop check every 5 minutes (powers down EC2 after 30 min of inactivity)
*/5 * * * * /usr/local/bin/ec2_autostop.sh >> /var/log/agenttrust_autostop.log 2>&1
```

---

## 🔒 AWS EC2 Security Group Hardening

Configure the following inbound rules in your AWS EC2 Security Group:

| Type | Protocol | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | `My IP` (`<YOUR_IP>/32`) | Restricted administrative access |
| **Custom TCP** | TCP | `8000` | Vercel / App Subnet | Primary FastAPI Backend API |
| **Custom TCP** | TCP | `6080` | Vercel / App Subnet | Interactive noVNC Video Websocket |

---

## 🚀 Building & Running Locally

```bash
# Build desktop container image
docker build -t agenttrust/desktop-environment:latest backend/docker/desktop

# Run container interactively
docker run -d -p 5901:5901 -p 6080:6080 --name agenttrust-desktop-test agenttrust/desktop-environment:latest
```
