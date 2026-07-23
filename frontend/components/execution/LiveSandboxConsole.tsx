"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clipboard, Eraser, Monitor, Terminal, Wifi } from "lucide-react";
import { ActionLogEntry } from "@/types";

type ConsoleTab = "terminal" | "display";

interface LiveSandboxConsoleProps {
  actionLog?: ActionLogEntry[] | null;
  stdout?: string | null;
  stderr?: string | null;
  isActive?: boolean;
  status?: string | null;
  agentProvider?: string | null;
  routingMode?: string | null;
  elapsedSeconds?: number;
  remoteDisplayUrl?: string | null;
}

const defaultRemoteDisplayUrl = process.env.NEXT_PUBLIC_EC2_NOVNC_URL || "";

function formatStep(step: number): string {
  return String(step).padStart(2, "0");
}

function buildLogLines({
  actionLog,
  stdout,
  stderr,
  isActive,
  status,
  agentProvider,
  routingMode,
  elapsedSeconds,
}: LiveSandboxConsoleProps): string[] {
  const lines = [
    `[SYSTEM] AgentTrust sandbox console initialized`,
    `[ROUTE] ${routingMode === "cloud_sandbox" ? "AWS EC2 sandbox worker" : "local engine or fallback"}`,
    `[MODE] ${agentProvider || "agent"} execution workspace`,
  ];

  if (isActive) {
    lines.push(`[RUN] execution active for ${elapsedSeconds || 0}s`);
    lines.push("[STREAM] waiting for worker telemetry packets...");
  } else if (status) {
    lines.push(`[RUN] execution status: ${status}`);
  } else {
    lines.push("[RUN] idle; submit a task to start telemetry capture");
  }

  actionLog?.forEach((entry) => {
    lines.push(
      `[STEP ${formatStep(entry.step)}] ${entry.action} :: ${entry.status.toUpperCase()} :: ${entry.target}`,
    );
    if (entry.note) {
      lines.push(`         ${entry.note}`);
    }
  });

  if (stdout) {
    lines.push("[STDOUT]");
    lines.push(...stdout.split(/\r?\n/).filter(Boolean));
  }

  if (stderr) {
    lines.push("[STDERR]");
    lines.push(...stderr.split(/\r?\n/).filter(Boolean).map((line) => `! ${line}`));
  }

  return lines;
}

export function LiveSandboxConsole(props: LiveSandboxConsoleProps) {
  const [activeTab, setActiveTab] = useState<ConsoleTab>("terminal");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [clearedSignature, setClearedSignature] = useState("");
  const logWindowRef = useRef<HTMLDivElement | null>(null);

  const remoteDisplayUrl = props.remoteDisplayUrl || defaultRemoteDisplayUrl;
  const showRemoteFrame = Boolean(remoteDisplayUrl && props.agentProvider === "browser");
  const isCloudRoute = props.routingMode === "cloud_sandbox";

  const telemetrySignature = JSON.stringify({
    actionCount: props.actionLog?.length || 0,
    stdout: props.stdout || "",
    stderr: props.stderr || "",
    isActive: Boolean(props.isActive),
    status: props.status || "",
  });

  const logLines = useMemo(() => {
    if (clearedSignature === telemetrySignature) {
      return ["[SCREEN] cleared; waiting for new telemetry..."];
    }
    return buildLogLines(props);
  }, [props, clearedSignature, telemetrySignature]);

  useEffect(() => {
    if (!autoScroll || !logWindowRef.current) {
      return;
    }
    logWindowRef.current.scrollTop = logWindowRef.current.scrollHeight;
  }, [autoScroll, logLines]);

  const copyLogs = async () => {
    await navigator.clipboard.writeText(logLines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const terminalPanel = (
    <section className="min-h-[420px] overflow-hidden border border-zinc-800 bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 font-mono text-[11px] uppercase text-cyan-200">
          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.9)]" />
          TELEMETRY STREAM :: {props.isActive ? "ACTIVE" : "READY"}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoScroll((value) => !value)}
            className={`inline-flex h-8 items-center gap-1 border px-3 font-mono text-[11px] uppercase transition-colors ${
              autoScroll
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                : "border-zinc-700 bg-zinc-950 text-zinc-400"
            }`}
            title="Toggle auto-scroll"
          >
            <Wifi className="h-3.5 w-3.5" />
            Auto
          </button>
          <button
            type="button"
            onClick={copyLogs}
            className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-950 text-zinc-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
            title="Copy terminal logs"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setClearedSignature(telemetrySignature)}
            className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-950 text-zinc-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
            title="Clear terminal screen"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div ref={logWindowRef} className="h-[360px] overflow-auto bg-zinc-950 p-4 font-mono text-xs leading-5 text-zinc-300">
        {logLines.map((line, index) => (
          <div
            key={`${line}-${index}`}
            className={line.startsWith("!") ? "whitespace-pre-wrap text-red-300" : "whitespace-pre-wrap"}
          >
            {line}
          </div>
        ))}
      </div>
    </section>
  );

  const displayPanel = (
    <section className="min-h-[420px] overflow-hidden border border-zinc-800 bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-mono text-[11px] uppercase text-emerald-200">
          <Monitor className="h-3.5 w-3.5" />
          REMOTE DISPLAY :: AWS EC2 SANDBOX
        </div>
        <span className="font-mono text-[11px] uppercase text-zinc-500">
          {isCloudRoute ? "cloud route" : "fallback preview"}
        </span>
      </div>
      <div className="relative h-[360px] bg-black">
        {showRemoteFrame ? (
          <iframe
            src={remoteDisplayUrl}
            title="AgentTrust remote EC2 sandbox display"
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl border border-zinc-700 bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-300 shadow-2xl shadow-black">
              <div className="border-b border-zinc-800 pb-2 text-cyan-200">EC2 SANDBOX REMOTE DISPLAY</div>
              <div className="pt-3">
                <div>Status: [WAITING FOR DISPLAY SIGNAL]</div>
                <div>Node: aws_ec2_worker_01</div>
                <div>Mode: Live VNC / Browser Agent Interactive View</div>
                <div>Provider: {props.agentProvider || "not selected"}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="overflow-hidden border border-zinc-800 bg-black p-3 text-white">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase text-zinc-500">Live execution workspace</p>
          <h2 className="text-base font-semibold text-zinc-100">Sandbox Console</h2>
        </div>
        <div className="hidden items-center gap-2 font-mono text-[11px] uppercase text-zinc-500 sm:flex">
          <Terminal className="h-3.5 w-3.5" />
          stdout / stderr / remote display
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("terminal")}
          className={`border px-3 py-2 text-sm ${
            activeTab === "terminal"
              ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
              : "border-zinc-800 bg-zinc-950 text-zinc-400"
          }`}
        >
          Terminal Logs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("display")}
          className={`border px-3 py-2 text-sm ${
            activeTab === "display"
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
              : "border-zinc-800 bg-zinc-950 text-zinc-400"
          }`}
        >
          Remote PC View
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={activeTab === "terminal" ? "block" : "hidden lg:block"}>{terminalPanel}</div>
        <div className={activeTab === "display" ? "block" : "hidden lg:block"}>{displayPanel}</div>
      </div>
    </div>
  );
}
