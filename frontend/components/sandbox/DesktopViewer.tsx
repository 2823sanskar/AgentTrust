"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { DesktopConnectInfo, Run } from "@/types";
import {
  DesktopToolbar,
  DesktopToolbarConnectionState,
  SpecialKeyCombination,
} from "@/components/sandbox/DesktopToolbar";

export interface DesktopViewerProps {
  runId: string;
  hostOverride?: string;
  onSessionEnded?: () => void;
  onSessionComplete?: (run?: Run) => void;
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
type QualityPreset = 2 | 5 | 8;
type RFBConstructor = typeof import("@novnc/novnc").default;
type RFBInstance = InstanceType<RFBConstructor>;

const HEARTBEAT_INTERVAL_MS = 30_000;
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10_000];
const KEY_DOWN_UP_DELAY_MS = 40;
const INTENTIONAL_DISCONNECT_CODES = new Set([1000, 1001, 4003]);
const qualitySettings: Record<QualityPreset, { qualityLevel: number; compressionLevel: number }> = {
  2: { qualityLevel: 2, compressionLevel: 8 },
  5: { qualityLevel: 5, compressionLevel: 5 },
  8: { qualityLevel: 8, compressionLevel: 2 },
};

function isIntentionalDisconnect(event: Event, stoppedByUser: boolean): boolean {
  if (stoppedByUser) return true;
  const detail =
    "detail" in event
      ? (event as CustomEvent<{ clean?: boolean; code?: number; reason?: string }>).detail
      : undefined;
  const code = detail?.code;
  const reason = detail?.reason || "";
  return Boolean(
    detail?.clean ||
      (typeof code === "number" && INTENTIONAL_DISCONNECT_CODES.has(code)) ||
      /code[:\s]+(1000|1001|4003)\b/i.test(reason) ||
      /session (stopped|ended|terminated)/i.test(reason),
  );
}

function resolveProxyOrigin(hostOverride?: string): string {
  if (typeof window === "undefined") return "";

  const explicitHost = hostOverride || process.env.NEXT_PUBLIC_DESKTOP_WS_HOST || "";
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const rawOrigin = explicitHost || configuredApiUrl || window.location.origin;

  if (/^wss?:\/\//i.test(rawOrigin)) {
    const parsed = new URL(rawOrigin);
    parsed.protocol = parsed.protocol === "wss:" ? "https:" : "http:";
    return parsed.origin;
  }
  if (/^https?:\/\//i.test(rawOrigin)) {
    return new URL(rawOrigin).origin;
  }
  if (rawOrigin.startsWith("/")) {
    return window.location.origin;
  }
  if (!explicitHost && !configuredApiUrl && window.location.port === "3000") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  const protocol = window.location.protocol || "http:";
  return `${protocol}//${rawOrigin.replace(/\/+$/, "")}`;
}

function buildWebsocketUrl(
  runId: string,
  connectInfo: DesktopConnectInfo,
  hostOverride?: string,
): string {
  if (typeof window === "undefined") return "";
  if (!connectInfo.session_token) return "";

  const proxyOrigin = resolveProxyOrigin(hostOverride);
  const parsedOrigin = new URL(proxyOrigin);
  const protocol = parsedOrigin.protocol === "https:" ? "wss:" : "ws:";
  const encodedRunId = encodeURIComponent(runId);
  const encodedToken = encodeURIComponent(connectInfo.session_token);

  return `${protocol}//${parsedOrigin.host}/api/v1/desktop/ws/${encodedRunId}?token=${encodedToken}`;
}

export function DesktopViewer({
  runId,
  hostOverride,
  onSessionEnded,
  onSessionComplete,
  className = "",
}: DesktopViewerProps) {
  const screenRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const rfbRef = useRef<RFBInstance | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const stoppedByUserRef = useRef(false);

  const [connectInfo, setConnectInfo] = useState<DesktopConnectInfo | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [viewOnly, setViewOnly] = useState(false);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("fit");
  const [qualityLevel, setQualityLevel] = useState<QualityPreset>(5);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [desktopName, setDesktopName] = useState("XFCE Desktop");
  const [remoteClipboardText, setRemoteClipboardText] = useState("");
  const [manualClipboardText, setManualClipboardText] = useState("");
  const [showClipboardFallback, setShowClipboardFallback] = useState(false);
  const [error, setError] = useState("");
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [RFBClass, setRFBClass] = useState<RFBConstructor | null>(null);

  const websocketUrl = useMemo(
    () => (connectInfo ? buildWebsocketUrl(runId, connectInfo, hostOverride) : ""),
    [connectInfo, hostOverride, runId],
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
      if (!nextConnectInfo.session_token) {
        throw new Error("Desktop connection is not ready yet.");
      }
    } catch (err) {
      setConnectionState("failed");
      setError(getErrorMessage(err, "Could not load desktop connection details."));
    }
  }, [runId]);

  useEffect(() => {
    let active = true;
    import("@novnc/novnc")
      .then((module) => {
        if (active) setRFBClass(() => module.default);
      })
      .catch((err) => {
        if (!active) return;
        setConnectionState("failed");
        setError(getErrorMessage(err, "Could not load desktop viewer."));
      });
    return () => {
      active = false;
    };
  }, []);

  const connect = useCallback(() => {
    if (!screenRef.current || !websocketUrl || !connectInfo?.session_token || !RFBClass) return;

    cleanupRfb();
    setConnectionState(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");
    setError("");

    const rfb = new RFBClass(screenRef.current, websocketUrl, {
      credentials: { password: connectInfo.session_token },
      shared: true,
    });
    rfb.background = "#050505";
    rfb.viewOnly = viewOnly;
    rfb.scaleViewport = scaleMode === "fit";
    rfb.resizeSession = false;
    rfb.qualityLevel = qualitySettings[qualityLevel].qualityLevel;
    rfb.compressionLevel = qualitySettings[qualityLevel].compressionLevel;
    rfbRef.current = rfb;

    rfb.addEventListener("connect", () => {
      reconnectAttemptRef.current = 0;
      setConnectionState("connected");
      rfb.focus();
    });

    rfb.addEventListener("disconnect", (event) => {
      rfbRef.current = null;
      if (isIntentionalDisconnect(event, stoppedByUserRef.current)) {
        setConnectionState(stoppedByUserRef.current ? "stopped" : "disconnected");
        setError(stoppedByUserRef.current ? "Desktop session ended." : "");
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

    rfb.addEventListener("clipboard", (event) => {
      const text =
        "detail" in event && (event as CustomEvent<{ text?: string }>).detail?.text
          ? (event as CustomEvent<{ text?: string }>).detail.text
          : "";
      if (!text) return;
      setRemoteClipboardText(text);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch((err) => {
          console.warn("Browser denied clipboard write access:", err);
        });
      }
    });
  }, [
    RFBClass,
    cleanupRfb,
    connectInfo,
    onSessionEnded,
    qualityLevel,
    scaleMode,
    viewOnly,
    websocketUrl,
  ]);

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
    if (!rfbRef.current) return;
    const settings = qualitySettings[qualityLevel];
    rfbRef.current.qualityLevel = settings.qualityLevel;
    rfbRef.current.compressionLevel = settings.compressionLevel;
  }, [qualityLevel]);

  useEffect(() => {
    const container = screenRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!rfbRef.current) return;
      rfbRef.current.scaleViewport = scaleMode === "fit";
      rfbRef.current.resizeSession = false;
    });
    observer.observe(container);
    return () => observer.disconnect();
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
      cleanupRfb();
      const stopResult = await api.stopDesktopSession(runId);
      setConnectionState("stopped");
      setError("Desktop session ended.");
      onSessionComplete?.(stopResult.run);
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

  const sendTextToDesktop = (text: string) => {
    if (!text.trim()) return;
    rfbRef.current?.clipboardPasteFrom(text);
    rfbRef.current?.focus();
  };

  const copyRemoteClipboard = async () => {
    if (!remoteClipboardText || !navigator.clipboard?.writeText) {
      setShowClipboardFallback(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(remoteClipboardText);
    } catch {
      setShowClipboardFallback(true);
    }
  };

  const pasteLocalClipboard = async () => {
    if (!navigator.clipboard?.readText) {
      setShowClipboardFallback(true);
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        sendTextToDesktop(text);
        setManualClipboardText(text);
      } else {
        setShowClipboardFallback(true);
      }
    } catch {
      setShowClipboardFallback(true);
    }
  };

  const sendKeyPress = (keysym: number, code?: string) => {
    rfbRef.current?.sendKey(keysym, code, true);
    window.setTimeout(() => rfbRef.current?.sendKey(keysym, code, false), KEY_DOWN_UP_DELAY_MS);
  };

  const sendSpecialKey = (keyCombination: SpecialKeyCombination) => {
    const rfb = rfbRef.current;
    if (!rfb || viewOnly) return;

    if (keyCombination === "ctrl_alt_del") {
      rfb.sendCtrlAltDel();
      return;
    }
    if (keyCombination === "super") {
      sendKeyPress(0xffeb, "MetaLeft");
      return;
    }
    if (keyCombination === "esc") {
      sendKeyPress(0xff1b, "Escape");
      return;
    }

    rfb.sendKey(0xffe9, "AltLeft", true);
    window.setTimeout(() => {
      rfb.sendKey(0xff09, "Tab", true);
      rfb.sendKey(0xff09, "Tab", false);
      rfb.sendKey(0xffe9, "AltLeft", false);
    }, KEY_DOWN_UP_DELAY_MS);
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

  const toolbarState: DesktopToolbarConnectionState =
    connectionState === "idle" || connectionState === "loading"
      ? "initializing"
      : connectionState === "failed"
        ? "error"
        : connectionState === "stopping" || connectionState === "stopped"
          ? "disconnected"
          : connectionState;

  return (
    <section
      ref={shellRef}
      className={`relative flex min-h-[420px] flex-col overflow-hidden border border-zinc-800 bg-zinc-950 text-zinc-100 ${className}`}
    >
      <DesktopToolbar
        runId={runId}
        connectionState={toolbarState}
        scaleViewport={scaleMode === "fit"}
        viewOnly={viewOnly}
        qualityLevel={qualityLevel}
        onToggleScaleViewport={() => setScaleMode((value) => (value === "fit" ? "native" : "fit"))}
        onToggleViewOnly={() => setViewOnly((value) => !value)}
        onChangeQuality={(level) => setQualityLevel(level === 2 || level === 8 ? level : 5)}
        onSendSpecialKey={sendSpecialKey}
        onCopyClipboard={copyRemoteClipboard}
        onPasteClipboard={pasteLocalClipboard}
        onToggleFullscreen={toggleFullscreen}
        onStopSession={stopSession}
        onReconnect={reconnect}
      />

      <div className="flex min-h-9 items-center justify-between gap-3 border-b border-zinc-900 px-4 py-2">
        <p className="truncate text-sm font-medium text-zinc-100">{desktopName}</p>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase text-zinc-500">
          {latencyMs !== null && <span>{latencyMs}ms</span>}
          <span>{scaleMode === "fit" ? "fit" : "native"}</span>
          <span>q{qualityLevel}</span>
        </div>
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
                {error ||
                  (connectionState === "stopped" || connectionState === "disconnected"
                    ? "Desktop session ended."
                    : "Preparing the interactive desktop stream.")}
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

      {showClipboardFallback && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg border border-zinc-700 bg-zinc-950 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-100">Clipboard</h3>
              <button
                type="button"
                onClick={() => setShowClipboardFallback(false)}
                className="h-8 border border-zinc-700 px-3 text-xs text-zinc-300 hover:text-zinc-100"
              >
                Close
              </button>
            </div>
            <textarea
              value={manualClipboardText || remoteClipboardText}
              onChange={(event) => setManualClipboardText(event.target.value)}
              rows={7}
              className="w-full border border-zinc-800 bg-black p-3 text-sm text-zinc-100 outline-none focus:border-emerald-400/40"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  sendTextToDesktop(manualClipboardText || remoteClipboardText);
                  setShowClipboardFallback(false);
                }}
                className="border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/20"
              >
                Send to Remote Desktop
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
