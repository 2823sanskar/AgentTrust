"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RFB from "@novnc/novnc";
import {
  Clipboard,
  Expand,
  Keyboard,
  Loader2,
  Maximize2,
  Monitor,
  MousePointer2,
  Power,
  RefreshCw,
  Shrink,
  Wifi,
  WifiOff,
} from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { DesktopConnectInfo } from "@/types";

interface DesktopViewerProps {
  runId: string;
  hostOverride?: string;
  onSessionEnded?: () => void;
  className?: string;
}

type ConnectionState =
  | "idle"
  | "loading"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed"
  | "stopping"
  | "stopped";
type ScaleMode = "fit" | "native";

const HEARTBEAT_INTERVAL_MS = 30_000;
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10_000];

function buildWebsocketUrl(connectInfo: DesktopConnectInfo, hostOverride?: string): string {
  if (typeof window === "undefined") return "";
  if (!connectInfo.websockify_port) return "";

  const explicitHost = hostOverride || process.env.NEXT_PUBLIC_DESKTOP_WS_HOST || "";
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
  const parsedBase = new URL(baseUrl, window.location.origin);
  const host = explicitHost || parsedBase.hostname || window.location.hostname;
  const protocol = parsedBase.protocol === "https:" || window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${host}:${connectInfo.websockify_port}`;
}

export function DesktopViewer({
  runId,
  hostOverride,
  onSessionEnded,
  className = "",
}: DesktopViewerProps) {
  const screenRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const rfbRef = useRef<RFB | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const stoppedByUserRef = useRef(false);

  const [connectInfo, setConnectInfo] = useState<DesktopConnectInfo | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [viewOnly, setViewOnly] = useState(false);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("fit");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [desktopName, setDesktopName] = useState("XFCE Desktop");
  const [clipboardText, setClipboardText] = useState("");
  const [error, setError] = useState("");
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const websocketUrl = useMemo(
    () => (connectInfo ? buildWebsocketUrl(connectInfo, hostOverride) : ""),
    [connectInfo, hostOverride],
  );

  const cleanupRfb = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (rfbRef.current) {
      rfbRef.current.disconnect();
      rfbRef.current = null;
    }
    if (screenRef.current) {
      screenRef.current.replaceChildren();
    }
  }, []);

  const loadConnectInfo = useCallback(async () => {
    setConnectionState("loading");
    setError("");
    try {
      const nextConnectInfo = await api.getDesktopConnectInfo(runId);
      setConnectInfo(nextConnectInfo);
      if (!nextConnectInfo.websockify_port || !nextConnectInfo.session_token) {
        throw new Error("Desktop connection is not ready yet.");
      }
    } catch (err) {
      setConnectionState("failed");
      setError(getErrorMessage(err, "Could not load desktop connection details."));
    }
  }, [runId]);

  const connect = useCallback(() => {
    if (!screenRef.current || !websocketUrl || !connectInfo?.session_token) return;

    cleanupRfb();
    setConnectionState(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");
    setError("");

    const rfb = new RFB(screenRef.current, websocketUrl, {
      credentials: { password: connectInfo.session_token },
      shared: true,
    });
    rfb.background = "#050505";
    rfb.viewOnly = viewOnly;
    rfb.scaleViewport = scaleMode === "fit";
    rfb.resizeSession = false;
    rfb.qualityLevel = 6;
    rfb.compressionLevel = 6;
    rfbRef.current = rfb;

    rfb.addEventListener("connect", () => {
      reconnectAttemptRef.current = 0;
      setConnectionState("connected");
      rfb.focus();
    });

    rfb.addEventListener("disconnect", (event) => {
      rfbRef.current = null;
      const clean = "detail" in event && (event as CustomEvent<{ clean?: boolean }>).detail?.clean;
      if (stoppedByUserRef.current || clean) {
        setConnectionState(stoppedByUserRef.current ? "stopped" : "disconnected");
        onSessionEnded?.();
        return;
      }
      const delay = RECONNECT_DELAYS_MS[reconnectAttemptRef.current];
      if (delay === undefined) {
        setConnectionState("failed");
        setError("Desktop stream disconnected and could not be reconnected.");
        return;
      }
      reconnectAttemptRef.current += 1;
      setConnectionState("reconnecting");
      reconnectTimerRef.current = setTimeout(() => {
        setReconnectNonce((value) => value + 1);
      }, delay);
    });

    rfb.addEventListener("securityfailure", (event) => {
      const reason =
        "detail" in event && (event as CustomEvent<{ reason?: string }>).detail?.reason
          ? (event as CustomEvent<{ reason?: string }>).detail.reason
          : "VNC authentication failed.";
      setConnectionState("failed");
      setError(reason || "VNC authentication failed.");
    });

    rfb.addEventListener("credentialsrequired", () => {
      rfb.sendCredentials({ password: connectInfo.session_token || "" });
    });

    rfb.addEventListener("desktopname", (event) => {
      const nextName =
        "detail" in event && (event as CustomEvent<{ name?: string }>).detail?.name
          ? (event as CustomEvent<{ name?: string }>).detail.name
          : "XFCE Desktop";
      setDesktopName(nextName || "XFCE Desktop");
    });
  }, [cleanupRfb, connectInfo, onSessionEnded, scaleMode, viewOnly, websocketUrl]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadConnectInfo();
    });
    return cleanupRfb;
  }, [cleanupRfb, loadConnectInfo]);

  useEffect(() => {
    if (websocketUrl && connectInfo?.session_token) {
      connect();
    }
  }, [connect, connectInfo, reconnectNonce, websocketUrl]);

  useEffect(() => {
    if (rfbRef.current) {
      rfbRef.current.viewOnly = viewOnly;
      rfbRef.current.focus();
    }
  }, [viewOnly]);

  useEffect(() => {
    if (rfbRef.current) {
      rfbRef.current.scaleViewport = scaleMode === "fit";
      rfbRef.current.resizeSession = false;
      rfbRef.current.focus();
    }
  }, [scaleMode]);

  useEffect(() => {
    heartbeatTimerRef.current = setInterval(async () => {
      const startedAt = performance.now();
      try {
        await api.sendDesktopHeartbeat(runId);
        setLatencyMs(Math.round(performance.now() - startedAt));
      } catch {
        setLatencyMs(null);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [runId]);

  const reconnect = async () => {
    reconnectAttemptRef.current = 0;
    stoppedByUserRef.current = false;
    await loadConnectInfo();
  };

  const stopSession = async () => {
    stoppedByUserRef.current = true;
    setConnectionState("stopping");
    setError("");
    try {
      await api.stopDesktopSession(runId);
      cleanupRfb();
      setConnectionState("stopped");
      onSessionEnded?.();
    } catch (err) {
      setConnectionState("failed");
      setError(getErrorMessage(err, "Could not stop desktop session."));
    }
  };

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await shell.requestFullscreen();
    rfbRef.current?.focus();
  };

  const pasteClipboard = () => {
    if (!clipboardText.trim()) return;
    rfbRef.current?.clipboardPasteFrom(clipboardText);
    rfbRef.current?.focus();
  };

  const statusLabel = {
    idle: "Idle",
    loading: "Loading",
    connecting: "Connecting",
    connected: "Connected",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
    failed: "Failed",
    stopping: "Stopping",
    stopped: "Stopped",
  }[connectionState];

  const isConnected = connectionState === "connected";

  return (
    <section
      ref={shellRef}
      className={`flex min-h-[420px] flex-col overflow-hidden border border-zinc-800 bg-zinc-950 text-zinc-100 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase text-emerald-200">
            {isConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span>{statusLabel}</span>
            {latencyMs !== null && <span className="text-zinc-500">{latencyMs}ms</span>}
          </div>
          <p className="truncate text-sm font-medium text-zinc-100">{desktopName}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewOnly((value) => !value)}
            className={`inline-flex h-8 items-center gap-1 border px-3 font-mono text-[11px] uppercase transition-colors ${
              viewOnly
                ? "border-zinc-700 bg-zinc-900 text-zinc-300"
                : "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
            }`}
            title="Toggle mouse and keyboard control"
          >
            {viewOnly ? <Monitor className="h-3.5 w-3.5" /> : <MousePointer2 className="h-3.5 w-3.5" />}
            {viewOnly ? "View" : "Control"}
          </button>
          <button
            type="button"
            onClick={() => setScaleMode((value) => (value === "fit" ? "native" : "fit"))}
            className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-100"
            title={scaleMode === "fit" ? "Switch to native resolution" : "Scale to fit window"}
          >
            {scaleMode === "fit" ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => rfbRef.current?.sendCtrlAltDel()}
            disabled={!isConnected || viewOnly}
            className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
            title="Send Ctrl+Alt+Del"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={reconnect}
            className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-100"
            title="Reconnect desktop stream"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${connectionState === "reconnecting" ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-100"
            title="Toggle fullscreen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={stopSession}
            disabled={connectionState === "stopping" || connectionState === "stopped"}
            className="inline-flex h-8 w-8 items-center justify-center border border-red-400/30 bg-red-500/10 text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            title="Stop desktop session"
          >
            {connectionState === "stopping" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-900 px-4 py-2">
        <Clipboard className="h-3.5 w-3.5 text-zinc-500" />
        <input
          value={clipboardText}
          onChange={(event) => setClipboardText(event.target.value)}
          placeholder="Paste text into the remote clipboard"
          className="h-8 min-w-[220px] flex-1 border border-zinc-800 bg-black px-3 text-xs text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-400/40"
        />
        <button
          type="button"
          onClick={pasteClipboard}
          disabled={!isConnected || viewOnly || !clipboardText.trim()}
          className="h-8 border border-zinc-700 bg-zinc-900 px-3 font-mono text-[11px] uppercase text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Paste
        </button>
      </div>

      <div className="relative min-h-[360px] flex-1 bg-black">
        <div
          ref={screenRef}
          tabIndex={0}
          className="h-full min-h-[360px] w-full overflow-auto outline-none [&_canvas]:mx-auto [&_canvas]:block"
          onClick={() => rfbRef.current?.focus()}
        />
        {connectionState !== "connected" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm border border-zinc-700 bg-zinc-950 p-5 text-center">
              {["loading", "connecting", "reconnecting", "stopping"].includes(connectionState) && (
                <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-emerald-200" />
              )}
              <p className="font-mono text-xs uppercase text-emerald-200">{statusLabel}</p>
              <p className="mt-2 text-sm text-zinc-400">
                {error || "Preparing the interactive desktop stream."}
              </p>
              {connectionState === "failed" && (
                <button
                  type="button"
                  onClick={reconnect}
                  className="mt-4 border border-emerald-400/40 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/10"
                >
                  Retry Connection
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
