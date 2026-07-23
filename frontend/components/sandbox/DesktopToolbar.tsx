"use client";

import {
  Clipboard,
  Expand,
  Gauge,
  Keyboard,
  Maximize2,
  Monitor,
  MousePointer2,
  Power,
  RefreshCw,
  Shrink,
  Wifi,
  WifiOff,
} from "lucide-react";

export type DesktopToolbarConnectionState =
  | "initializing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export type SpecialKeyCombination = "ctrl_alt_del" | "super" | "alt_tab" | "esc";

interface DesktopToolbarProps {
  runId: string;
  connectionState: DesktopToolbarConnectionState;
  scaleViewport: boolean;
  viewOnly: boolean;
  qualityLevel: number;
  onToggleScaleViewport: () => void;
  onToggleViewOnly: () => void;
  onChangeQuality: (level: number) => void;
  onSendSpecialKey: (keyCombination: SpecialKeyCombination) => void;
  onCopyClipboard: () => void;
  onPasteClipboard: () => void;
  onToggleFullscreen: () => void;
  onStopSession: () => void;
  onReconnect: () => void;
}

const qualityOptions = [
  { label: "Low Latency", value: 2 },
  { label: "Balanced", value: 5 },
  { label: "High Quality", value: 8 },
];

const keyOptions: { label: string; value: SpecialKeyCombination }[] = [
  { label: "Ctrl Alt Del", value: "ctrl_alt_del" },
  { label: "Super", value: "super" },
  { label: "Alt Tab", value: "alt_tab" },
  { label: "Esc", value: "esc" },
];

export function DesktopToolbar({
  runId,
  connectionState,
  scaleViewport,
  viewOnly,
  qualityLevel,
  onToggleScaleViewport,
  onToggleViewOnly,
  onChangeQuality,
  onSendSpecialKey,
  onCopyClipboard,
  onPasteClipboard,
  onToggleFullscreen,
  onStopSession,
  onReconnect,
}: DesktopToolbarProps) {
  const isConnected = connectionState === "connected";
  const statusTone = isConnected
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
    : connectionState === "error"
      ? "border-red-400/30 bg-red-500/10 text-red-100"
      : "border-amber-400/30 bg-amber-400/10 text-amber-100";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`inline-flex h-8 items-center gap-2 border px-3 font-mono text-[11px] uppercase ${statusTone}`}
          title={`Desktop run ${runId}`}
        >
          {isConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {connectionState}
        </span>
        <span className="hidden max-w-[180px] truncate font-mono text-[11px] uppercase text-zinc-500 sm:inline">
          {runId}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleViewOnly}
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
          onClick={onToggleScaleViewport}
          className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-100"
          title={scaleViewport ? "Switch to native resolution" : "Scale to fit window"}
        >
          {scaleViewport ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
        </button>

        <label className="inline-flex h-8 items-center gap-2 border border-zinc-700 bg-zinc-900 px-2 text-zinc-300">
          <Gauge className="h-3.5 w-3.5" />
          <select
            value={qualityLevel}
            onChange={(event) => onChangeQuality(Number(event.target.value))}
            className="bg-transparent font-mono text-[11px] uppercase outline-none"
            title="Stream quality"
          >
            {qualityOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-zinc-950 text-zinc-100">
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-flex h-8 items-center gap-2 border border-zinc-700 bg-zinc-900 px-2 text-zinc-300">
          <Keyboard className="h-3.5 w-3.5" />
          <select
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value as SpecialKeyCombination;
              if (value) onSendSpecialKey(value);
              event.target.value = "";
            }}
            disabled={!isConnected || viewOnly}
            className="bg-transparent font-mono text-[11px] uppercase outline-none disabled:cursor-not-allowed disabled:opacity-40"
            title="Send special key"
          >
            <option value="" className="bg-zinc-950 text-zinc-100">
              Keys
            </option>
            {keyOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-zinc-950 text-zinc-100">
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onCopyClipboard}
          disabled={!isConnected}
          className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
          title="Copy remote clipboard to browser clipboard"
        >
          <Clipboard className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={onPasteClipboard}
          disabled={!isConnected || viewOnly}
          className="h-8 border border-zinc-700 bg-zinc-900 px-3 font-mono text-[11px] uppercase text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
          title="Paste browser clipboard into the remote desktop"
        >
          Paste
        </button>

        <button
          type="button"
          onClick={onReconnect}
          className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-100"
          title="Reconnect desktop stream"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${connectionState === "reconnecting" ? "animate-spin" : ""}`} />
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="inline-flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-100"
          title="Toggle fullscreen"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={onStopSession}
          className="inline-flex h-8 w-8 items-center justify-center border border-red-400/30 bg-red-500/10 text-red-200 transition-colors hover:bg-red-500/20"
          title="Stop desktop session"
        >
          <Power className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
