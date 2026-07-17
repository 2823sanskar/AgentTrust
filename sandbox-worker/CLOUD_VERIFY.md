# AgentTrust Cloud Verification Manual

Follow this checklist to confirm your live AWS Staging infrastructure is operational.

---

## Check 1: External Gateway Handshake Check

Run this terminal command from your personal computer to hit the public gateway. It should return a clean status profile indicating the worker inside the cloud container is listening.

```bash
# Replace 1.2.3.4 with your actual AWS Public IP address
curl -v http://1.2.3.4/health
```

### Expected Response Signature

```json
{
  "status": "ok",
  "worker": "agenttrust-sandbox-worker",
  "docker_cli_ready": true,
  "docker_daemon_ready": true,
  "environment": "production"
}
```

---

## Check 2: Live Log Stream Inspection

To monitor AI container operations or trace communication faults inside your remote Amazon computer, log into your EC2 host and inspect the real-time runtime streams.

```bash
# 1. Connect to the cloud host
ssh ubuntu@YOUR_AWS_EC2_PUBLIC_IP

# 2. Navigate to your staging workspace
cd /home/ubuntu/sandbox-worker

# 3. Stream live container interaction logs
sudo docker compose -f compose.staging.yml logs -f --tail=50
```

---

## Check 3: Local Dashboard Routing Switch

To direct your local developer dashboard to talk across the open internet to your live cloud worker, boot up your local system using this command string:

```bash
# Terminal command to point your local machine to AWS
NEXT_PUBLIC_AWS_SANDBOX_URL="http://YOUR_AWS_EC2_PUBLIC_IP" NODE_ENV="production" npm run dev
```

Verify: your dashboard status widget should turn green and print `AWS Cloud Sandbox: Active` alongside your internet response speed.

---

## Check 4: Backend Proxy Diagnostic

From your local backend environment, point `SANDBOX_WORKER_URL` at the AWS worker and run:

```bash
SANDBOX_WORKER_URL="http://YOUR_AWS_EC2_PUBLIC_IP" python tests/test_cloud_connectivity.py
```

Expected result:

```text
Test 1: network pipeline verified
Test 2: timeout circuit breaker verified
```

---

## Check 5: Remote Worker Compose Status

Inside the EC2 host:

```bash
cd /home/ubuntu/sandbox-worker
sudo docker compose -f compose.staging.yml ps
sudo docker compose -f compose.staging.yml exec agenttrust-sandbox-worker curl -s http://localhost:9000/health
```

The service should be `Up`, and `/health` should report Docker daemon readiness.
