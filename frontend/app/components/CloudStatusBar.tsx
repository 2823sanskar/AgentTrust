"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Cloud, CloudOff, RefreshCw } from "lucide-react";

export default function CloudStatusBar() {
  const [isMounted, setIsMounted] = useState(false);
  const [status, setStatus] = useState<"checking" | "cloud" | "fallback">("checking");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    async function verifyPipeline() {
      const startTime = performance.now();
      try {
        const res = await fetch("/api/sandbox/health", { cache: "no-store" });
        const data = await res.json();
        const duration = Math.round(performance.now() - startTime);

        if (res.ok && data.status === "healthy" && data.environment === "production") {
          setStatus("cloud");
          setLatency(duration);
        } else {
          setStatus("fallback");
        }
      } catch {
        setStatus("fallback");
      }
    }

    void verifyPipeline();
  }, [isMounted]);

  if (!isMounted) {
    return <div className="h-16 rounded-xl border border-gray-800 bg-[#0b112c] animate-pulse" />;
  }

  return (
    <div className="p-4 rounded-xl border border-gray-800 bg-[#0b112c] text-xs flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {status === "checking" && (
          <>
            <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
            <span className="text-gray-400 font-medium">Interrogating remote pipeline link status...</span>
          </>
        )}
        {status === "cloud" && (
          <>
            <Cloud className="h-4 w-4 text-emerald-400" />
            <div>
              <span className="text-white font-semibold block">AWS Cloud Sandbox: Active</span>
              <span className="text-[10px] text-gray-400 font-mono">Routing through high-speed Nginx edge proxy</span>
            </div>
          </>
        )}
        {status === "fallback" && (
          <>
            <CloudOff className="h-4 w-4 text-amber-400" />
            <div>
              <span className="text-amber-400 font-semibold block">Fail-Safe Route Engaged: Local Mode</span>
              <span className="text-[10px] text-gray-400">AWS cluster unreachable. Running isolated fallback loop.</span>
            </div>
          </>
        )}
      </div>

      {status === "cloud" && latency !== null && (
        <span className="bg-[#101b37] text-emerald-400 px-2 py-1 rounded border border-gray-700 font-mono text-[10px]">
          Ping: {latency}ms
        </span>
      )}
      {status === "fallback" && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />}
    </div>
  );
}
