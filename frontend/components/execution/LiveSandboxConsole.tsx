"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Check,
  Clipboard,
  Download,
  Eraser,
  Monitor,
  RefreshCw,
  Terminal,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ActionLogEntry, Run } from "@/types";
import type { DesktopViewerProps } from "@/components/sandbox/DesktopViewer";

const DesktopViewer = dynamic<DesktopViewerProps>(
  () => import("@/components/sandbox/DesktopViewer").then((module) => module.DesktopViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[360px] items-center justify-center bg-black p-4 font-mono text-xs uppercase text-emerald-200">
        Loading desktop viewer...
      </div>
    ),
  },
);

type ConsoleTab = "terminal" | "display";
type StreamState = "idle" | "connecting" | "connected" | "retrying" | "closed" | "failed";
type FrameState = "standby" | "loaded" | "retrying" | "offline";

interface LiveSandboxConsoleProps {
  runId?: string | null;
  streamUrl?: string | null;
  actionLog?: ActionLogEntry[] | null;
  stdout?: string | null;
  stderr?: string | null;
  isActive?: boolean;
  status?: string | null;
  agentProvider?: string | null;
  routingMode?: string | null;
  elapsedSeconds?: number;
  remoteDisplayUrl?: string | null;
  isInteractive?: boolean;
  desktopStatus?: string | null;
  onInteractiveSessionEnded?: () => void;
  onInteractiveSessionComplete?: (run?: Run) => void;
}

const MAX_RECONNECTS = 5;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];
const MAX_RENDERED_LINES = 2000;
const defaultRemoteDisplayUrl = process.env.NEXT_PUBLIC_EC2_NOVNC_URL || "";

function formatStep(step: number): string {
  return String(step).padStart(2, "0");
}

function normalizeRemoteUrl(input?: string | null): string {
  const rawUrl = (input || defaultRemoteDisplayUrl).trim();
  if (!rawUrl) return "";
  if (typeof window === "undefined") return rawUrl;

  try {
    if (rawUrl.startsWith("/")) return new URL(rawUrl, window.location.origin).toString();
    if (!/^https?:\/\//i.test(rawUrl)) {
      return `${window.location.protocol || "http:"}//${rawUrl}`;
    }
    const parsed = new URL(rawUrl);
    const isLocalHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
    if (!isLocalHost) return parsed.toString();
    parsed.hostname = window.location.hostname || "127.0.0.1";
    return parsed.toString();
  } catch {
    const normalized = rawUrl.replace(/^\/+/, "");
    const protocol = window.location.protocol || "http:";
    return `${protocol}//${normalized}`;
  }
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
  runId,
  isInteractive,
  desktopStatus,
}: LiveSandboxConsoleProps): string[] {
  const lines = [
    "[SYSTEM] AgentTrust sandbox console initialized",
    `[ROUTE] ${routingMode === "cloud_sandbox" ? "AWS EC2 sandbox worker" : "local engine or fallback"}`,
    `[MODE] ${agentProvider || "agent"} execution workspace`,
  ];

  if (isInteractive && runId && desktopStatus === "pending") {
    lines.push("[RUN] interactive desktop starting...");
    lines.push("[STREAM] waiting for desktop telemetry packets...");
  } else if (isInteractive && runId && desktopStatus === "running") {
    lines.push("[RUN] active; streaming interactive desktop telemetry...");
  } else if (isInteractive && runId && desktopStatus === "stopped") {
    lines.push("[RUN] interactive desktop session completed");
  } else if (isInteractive && runId && desktopStatus === "stopping") {
    lines.push("[RUN] stopping interactive desktop session...");
  } else if (
    isInteractive &&
    runId &&
    (desktopStatus === "failed" || desktopStatus === "timed_out")
  ) {
    lines.push(`[RUN] interactive desktop session ${desktopStatus.replace("_", " ")}`);
  } else if (isActive) {
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
    if (entry.note) lines.push(`         ${entry.note}`);
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

function linesFromRun(run: Run): string[] {
  return buildLogLines({
    actionLog: run.action_log,
    stdout: run.container_stdout,
    stderr: run.container_stderr,
    isActive: run.status === "pending",
    status: run.status,
    routingMode: run.routing_mode,
    runId: run.id,
    isInteractive: run.is_interactive,
    desktopStatus: run.desktop_status,
  });
}

function resolveStreamUrl(runId?: string | null, streamUrl?: string | null): string {
  if (streamUrl) return streamUrl;
  if (!runId) return "";
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("access_token") || window.localStorage.getItem("token") || ""
      : "";
  const query = token ? `?token=${encodeURIComponent(token)}` : "";

  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  if (configuredApiUrl) {
    const base = configuredApiUrl.replace(/\/+$/, "");
    return `${base}/v1/runs/${runId}/stream${query}`;
  }
  return `/api/runs/${runId}/stream${query}`;
}

export function LiveSandboxConsole(props: LiveSandboxConsoleProps) {
  const [activeTab, setActiveTab] = useState<ConsoleTab>("terminal");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [clearedSignature, setClearedSignature] = useState("");
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [retryCount, setRetryCount] = useState(0);
  const [frameState, setFrameState] = useState<FrameState>("standby");
  const [frameRetryKey, setFrameRetryKey] = useState(0);
  const [endedInteractiveRunId, setEndedInteractiveRunId] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const lastAutoFocusedRunIdRef = useRef<string | null>(null);
  const logWindowRef = useRef<HTMLDivElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remoteDisplayUrl = useMemo(
    () => normalizeRemoteUrl(props.remoteDisplayUrl),
    [props.remoteDisplayUrl],
  );
  const showRemoteFrame = Boolean(remoteDisplayUrl && props.agentProvider === "browser");
  const desktopIsLive = Boolean(
    props.isInteractive &&
      props.runId &&
      ["pending", "running"].includes(props.desktopStatus || "") &&
      endedInteractiveRunId !== props.runId,
  );
  const isCloudRoute = props.routingMode === "cloud_sandbox";
  const sseUrl = resolveStreamUrl(props.runId, props.streamUrl);
  const shouldStream = Boolean(sseUrl && (props.isActive || props.status === "pending"));

  const telemetrySignature = JSON.stringify({
    actionCount: props.actionLog?.length || 0,
    stdout: props.stdout || "",
    stderr: props.stderr || "",
    isActive: Boolean(props.isActive),
    status: props.status || "",
    desktopStatus: props.desktopStatus || "",
    runId: props.runId || "",
    streamCount: streamLines.length,
  });

  const baseLogLines = useMemo(() => buildLogLines(props), [props]);
  const logLines = useMemo(() => {
    if (clearedSignature === telemetrySignature) {
      return ["[SCREEN] cleared; waiting for new telemetry..."];
    }
    return streamLines.length ? streamLines : baseLogLines;
  }, [baseLogLines, clearedSignature, streamLines, telemetrySignature]);

  const visibleLogLines = useMemo(() => {
    if (logLines.length <= MAX_RENDERED_LINES) return logLines;
    return [
      `[SCREEN] showing latest ${MAX_RENDERED_LINES} of ${logLines.length} log lines`,
      ...logLines.slice(-MAX_RENDERED_LINES),
    ];
  }, [logLines]);

  useEffect(() => {
    if (!autoScroll || !logWindowRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (logWindowRef.current) {
        logWindowRef.current.scrollTop = logWindowRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [autoScroll, visibleLogLines]);

  useEffect(() => {
    if (!desktopIsLive || !props.runId) return;
    if (lastAutoFocusedRunIdRef.current === props.runId) return;

    lastAutoFocusedRunIdRef.current = props.runId;
    const frame = requestAnimationFrame(() => {
      setActiveTab("display");
      workspaceRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [desktopIsLive, props.runId]);

  useEffect(() => {
    if (!shouldStream) {
      return;
    }

    let closed = false;

    const closeStream = () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };

    const connect = (attempt: number) => {
      closeStream();
      setRetryCount(attempt);
      setStreamState(attempt === 0 ? "connecting" : "retrying");
      const source = new EventSource(sseUrl);
      eventSourceRef.current = source;

      source.onopen = () => {
        if (closed) return;
        setStreamState("connected");
        setRetryCount(0);
      };

      source.onmessage = (event) => {
        if (closed || !event.data) return;
        try {
          const data = JSON.parse(event.data) as { type?: string; run?: Run; lines?: string[]; message?: string };
          if (data.type === "complete") {
            if (data.run) setStreamLines(linesFromRun(data.run));
            setStreamState("closed");
            closeStream();
            return;
          }
          if (data.type === "snapshot" && data.run) {
            setStreamLines(linesFromRun(data.run));
            return;
          }
          if (Array.isArray(data.lines)) {
            const nextLines = data.lines;
            setStreamLines((current) => [...current, ...nextLines]);
            return;
          }
          if (data.message) setStreamLines((current) => [...current, data.message || ""]);
        } catch {
          setStreamLines((current) => [...current, event.data]);
        }
      };

      source.onerror = () => {
        if (closed) return;
        closeStream();
        if (attempt >= MAX_RECONNECTS) {
          setStreamState("failed");
          return;
        }
        const delay = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
        setStreamState("retrying");
        reconnectTimerRef.current = setTimeout(() => connect(attempt + 1), delay);
      };
    };

    connect(0);

    return () => {
      closed = true;
      closeStream();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [shouldStream, sseUrl]);

  useEffect(() => {
    if (!showRemoteFrame) return;
    if (frameTimerRef.current) clearTimeout(frameTimerRef.current);
    frameTimerRef.current = setTimeout(() => setFrameState("offline"), 10_000);
    return () => {
      if (frameTimerRef.current) clearTimeout(frameTimerRef.current);
    };
  }, [frameRetryKey, showRemoteFrame, remoteDisplayUrl]);

  const handleLogScroll = useCallback(() => {
    const element = logWindowRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setAutoScroll(distanceFromBottom < 48);
  }, []);

  const copyLogs = async () => {
    await navigator.clipboard.writeText(logLines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadLogs = () => {
    const blob = new Blob([logLines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agenttrust-${props.runId || "sandbox"}-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const retryFrame = () => {
    setFrameState("retrying");
    setFrameRetryKey((value) => value + 1);
  };

  const effectiveStreamState = shouldStream ? streamState : sseUrl ? "closed" : "idle";
  const streamBadge = {
    idle: "IDLE",
    connecting: "CONNECTING",
    connected: "ACTIVE",
    retrying: `RETRY ${retryCount}/${MAX_RECONNECTS}`,
    closed: "READY",
    failed: "OFFLINE",
  }[effectiveStreamState];

  const terminalPanel = (
    <section className="flex min-h-[240px] max-h-[280px] flex-col overflow-hidden border border-zinc-800 bg-zinc-900 lg:h-[640px] lg:max-h-none lg:min-h-[420px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 font-mono text-[11px] uppercase text-cyan-200">
          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.9)]" />
          TELEMETRY STREAM :: {streamBadge}
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
            {streamState === "failed" ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
            Auto
          </button>
          <button
            type="button"
            onClick={copyLogs}
            className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-950 text-zinc-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
            title="Copy clean terminal logs"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={downloadLogs}
            className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-950 text-zinc-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
            title="Download terminal logs"
          >
            <Download className="h-3.5 w-3.5" />
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
      <div
        ref={logWindowRef}
        onScroll={handleLogScroll}
        className="min-h-0 flex-1 overflow-auto bg-zinc-950 p-4 font-mono text-xs leading-5 text-zinc-300"
      >
        {visibleLogLines.map((line, index) => (
          <div
            key={`${index}-${line.slice(0, 32)}`}
            className={line.startsWith("!") ? "whitespace-pre-wrap text-red-300" : "whitespace-pre-wrap"}
          >
            {line}
          </div>
        ))}
      </div>
    </section>
  );

  const displayPanel = (
    <section className="flex h-[min(70vh,640px)] min-h-[360px] flex-col overflow-hidden border border-zinc-800 bg-zinc-900 lg:h-[640px] lg:min-h-[420px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-mono text-[11px] uppercase text-emerald-200">
          <Monitor className="h-3.5 w-3.5" />
          REMOTE DISPLAY :: AWS EC2 SANDBOX
        </div>
        <span className="font-mono text-[11px] uppercase text-zinc-500">
          {isCloudRoute ? "cloud route" : "fallback preview"}
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto bg-black">
        {desktopIsLive && props.runId ? (
          <DesktopViewer
            runId={props.runId}
            onSessionEnded={() => {
              setEndedInteractiveRunId(props.runId || null);
              props.onInteractiveSessionEnded?.();
            }}
            onSessionComplete={(run) => {
              setEndedInteractiveRunId(props.runId || null);
              props.onInteractiveSessionComplete?.(run);
            }}
            className="h-full min-h-[360px] border-0 lg:min-h-full"
          />
        ) : showRemoteFrame ? (
          <>
            {frameState !== "loaded" && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/90 p-4">
                <div className="max-w-sm border border-zinc-700 bg-zinc-950 p-5 text-center font-mono text-xs text-zinc-300">
                  <RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin text-emerald-200" />
                  <div className="text-emerald-200">Connecting to Remote PC Worker...</div>
                  {frameState === "offline" && (
                    <div className="mt-3 border border-amber-400/30 bg-amber-400/10 p-3 text-amber-100">
                      Worker Offline / Retrying
                      <button
                        type="button"
                        onClick={retryFrame}
                        className="mt-3 block w-full border border-amber-300/40 px-3 py-2 text-amber-50 hover:bg-amber-300/10"
                      >
                        Retry Stream
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <iframe
              key={`${remoteDisplayUrl}-${frameRetryKey}`}
              src={remoteDisplayUrl}
              title="AgentTrust remote EC2 sandbox display"
              sandbox="allow-scripts allow-same-origin"
              className="h-full min-h-[360px] w-full border-0 lg:min-h-full"
              onLoad={() => {
                if (frameTimerRef.current) clearTimeout(frameTimerRef.current);
                setFrameState("loaded");
              }}
            />
          </>
        ) : (
          <div className="flex h-full min-h-[360px] items-center justify-center p-4">
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
    <div
      ref={workspaceRef}
      className="scroll-mt-24 overflow-hidden border border-zinc-800 bg-black p-3 text-white"
    >
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
          Logs
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
          Display
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <div className={activeTab === "display" ? "block" : "hidden lg:block"}>{displayPanel}</div>
        <div className={activeTab === "terminal" ? "block" : "hidden lg:block"}>{terminalPanel}</div>
      </div>
    </div>
  );
}
