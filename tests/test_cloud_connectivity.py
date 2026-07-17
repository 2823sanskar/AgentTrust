import asyncio
import os
import sys

# Dynamically patch the system runtime execution path to resolve backend root references
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_ROOT = os.path.join(REPO_ROOT, "backend")
sys.path.append(BACKEND_ROOT)

ENV_PATH = os.path.join(BACKEND_ROOT, ".env")
if os.path.exists(ENV_PATH):
    with open(ENV_PATH, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

from app.config import settings
from app.services.vm_sandbox import VMSandboxService


async def run_diagnostic():
    print("=====================================================================")
    print("      AGENTTRUST WORKSPACE: CLOUD INTEGRATION LINK DIAGNOSTIC        ")
    print("=====================================================================")

    print(f"[*] Target Proxy Gateway Location: {settings.SANDBOX_WORKER_URL or 'UNCONFIGURED'}")

    if not settings.SANDBOX_WORKER_URL:
        print("\n[X] CRITICAL ERROR: The global configuration token SANDBOX_WORKER_URL is empty.")
        print("    Please set the environment parameter locally before running this verification script.")
        sys.exit(1)

    # Instantiate the communication layer service proxy
    sandbox_client = VMSandboxService()

    # ---------------------------------------------------------
    # TEST CASE 1: Baseline Structural Traffic Verification Handshake
    # ---------------------------------------------------------
    mock_payload = {
        "run_id": "integration_diagnostic_loop_2026",
        "agent_image": "hello-world:latest",
        "task": "Execute full-stack cloud pipeline transport verification handshake.",
        "timeout_seconds": 15,
    }

    print("\n[Test 1] Dispatching standard mock container payload envelope across network...")
    print("  -> Shipping payload coordinates to endpoint. Awaiting handshake reply...")

    try:
        response = await sandbox_client.execute_remote_run(mock_payload)

        print("\n[+] --- Handshake Telemetry Decoded From Remote Node ---")
        print(f"    Status Token:   {response.get('status')}")
        print(f"    System Exit:    {response.get('exit_code')}")
        print(f"    Measured Span:  {response.get('execution_time')} seconds")
        print(f"    Gateway Trace:  {str(response.get('final_output'))[:60]}...")
        print("    ---------------------------------------------------------")

        # Check if the network path completed cleanly or if it returned our valid circuit breaker envelope
        if response.get("status") in ["success", "failure"] and response.get("exit_code") is not None:
            print("\n[OK] SUCCESS: Network pipeline loop structural link communication verified.")
        else:
            print("\n[X] PIPELINE MISALIGNMENT: Node replied, but returned an invalid structural signature.")

    except Exception as e:
        print("\n[X] FAILED CONNECTION HANDSHAKE: Unable to talk across the endpoint interface.")
        print(f"    Diagnostic Error Log Trace: {str(e)}")

    # ---------------------------------------------------------
    # TEST CASE 2: Intentional Timeout Protection Circuit Breaker Stress Verification
    # ---------------------------------------------------------
    print("\n[Test 2] Inducing deliberate processing deadline timeout error...")
    print("  -> Sending payload with hyper-strict 1-second constraint to force breaker trip...")

    # Inject a tight 1-second timeout limit to force the client to sever the pipeline
    timeout_payload = {
        **mock_payload,
        "run_id": "forced_timeout_breaker_99",
        "agent_image": "agenttrust-compliant-test:latest",
        "docker_command": "python -c \"import time; time.sleep(5)\"",
        "timeout_seconds": 1,
    }

    try:
        breaker_response = await sandbox_client.execute_remote_run(timeout_payload)
        captured_exit = breaker_response.get("exit_code")

        print(f"  -> Server Response Code Captured: {captured_exit}")

        if captured_exit in [124, 503] or (
            breaker_response.get("status") == "failure"
            and captured_exit is not None
            and captured_exit != 0
        ):
            print("\n[OK] SUCCESS: Timeout circuit breaker returned a controlled failure envelope.")
            print(f"    Emergency Output Tracked: {breaker_response.get('final_output')}")
        else:
            print(f"\n[X] BREAKER FAILED: Expected controlled non-zero safety exit code, but caught {captured_exit}")

    except Exception as e:
        print(f"\n[X] CRITICAL ERROR: Unhandled system explosion occurred instead of a smooth breaker trip: {str(e)}")

    print("\n=====================================================================")
    print("            DIAGNOSTIC AUTOMATION CHECK SEQUENCE COMPLETE            ")
    print("=====================================================================")


if __name__ == "__main__":
    # Launch the asynchronous runtime loop event engine
    asyncio.run(run_diagnostic())
