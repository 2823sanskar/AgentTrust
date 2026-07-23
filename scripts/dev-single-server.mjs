import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendDir = path.join(rootDir, "frontend");
const backendDir = path.join(rootDir, "backend");

const host = "127.0.0.1";
const frontendPort = 3000;
const backendPort = 8000;

const isWindows = process.platform === "win32";
const pythonExe = isWindows
  ? path.join(backendDir, ".venv", "Scripts", "python.exe")
  : path.join(backendDir, ".venv", "bin", "python");
const frontendCommand = isWindows ? "cmd.exe" : "npm";
const frontendArgs = isWindows
  ? ["/c", "npm.cmd", "run", "dev", "--", "-H", host, "-p", String(frontendPort)]
  : ["run", "dev", "--", "-H", host, "-p", String(frontendPort)];

function cleanEnv(extra = {}) {
  const env = {};
  let pathValue = "";

  for (const [key, value] of Object.entries(process.env)) {
    if (key.toLowerCase() === "path") {
      pathValue = pathValue || value || "";
    } else if (value !== undefined) {
      env[key] = value;
    }
  }

  env.Path = pathValue;
  return { ...env, ...extra };
}

function startProcess(name, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });
  child.on("exit", (code) => {
    process.stdout.write(`[${name}] exited with code ${code}\n`);
  });
  return child;
}

async function waitForBackend(timeoutMs = 45_000) {
  const healthUrl = `http://${host}:${backendPort}/health`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(healthUrl, { cache: "no-store" });
      if (response.ok) {
        return true;
      }
    } catch {
      // Backend is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

const backendEnv = cleanEnv({
  DEBUG: process.env.DEBUG || "false",
  ENVIRONMENT: process.env.ENVIRONMENT || "development",
  PYTHONPATH: backendDir,
});

const frontendEnv = cleanEnv({
  NEXT_PUBLIC_API_URL: "/api",
});

const optionalBackendEnv = {};
for (const key of [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_ALGORITHM",
  "JWT_EXPIRATION_MINUTES",
  "STELLAR_SECRET_KEY",
  "STELLAR_PUBLIC_KEY",
]) {
  if (process.env[key]) {
    optionalBackendEnv[key] = process.env[key];
  }
}

const backend = startProcess(
  "backend",
  pythonExe,
  ["-m", "uvicorn", "app.main:app", "--host", host, "--port", String(backendPort)],
  { cwd: backendDir, env: { ...backendEnv, ...optionalBackendEnv } },
);

process.stdout.write(`AgentTrust local app: http://${host}:${frontendPort}\n`);

const backendReady = await waitForBackend();
if (!backendReady) {
  process.stderr.write(
    `[backend] health check did not pass within startup window; starting frontend anyway\n`,
  );
}

const frontend = startProcess(
  "frontend",
  frontendCommand,
  frontendArgs,
  { cwd: frontendDir, env: frontendEnv },
);

function shutdown() {
  backend.kill();
  frontend.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
