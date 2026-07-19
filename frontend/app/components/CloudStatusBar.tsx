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
    return <div className="h-16 rounded-[22px] border border-[#d9cfba] bg-white animate-pulse" />;
  }

  return (
    <div className="p-4 rounded-[22px] border border-[#d9cfba] bg-white text-xs flex items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-2">
        {status === "checking" && (
          <>
            <RefreshCw className="h-4 w-4 text-[#007c89] animate-spin" />
            <span className="text-[#6b6257] font-medium">Checking sandbox route...</span>
          </>
        )}
        {status === "cloud" && (
          <>
            <Cloud className="h-4 w-4 text-[#007c89]" />
            <div>
              <span className="text-[#241c15] font-semibold block">AWS Cloud Sandbox: Active</span>
              <span className="text-[10px] text-[#6b6257] font-mono">Nginx edge proxy / Docker worker</span>
            </div>
          </>
        )}
        {status === "fallback" && (
          <>
            <CloudOff className="h-4 w-4 text-[#8b5e00]" />
            <div>
              <span className="text-[#8b5e00] font-semibold block">Local Mode Active</span>
              <span className="text-[10px] text-[#6b6257]">AWS cluster unreachable. Running isolated fallback loop.</span>
            </div>
          </>
        )}
      </div>

      {status === "cloud" && latency !== null && (
        <span className="bg-[#d8f3f0] text-[#004e56] px-2.5 py-1 rounded-full border border-[#8fcac4] font-mono text-[10px]">
          Ping: {latency}ms
        </span>
      )}
      {status === "fallback" && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />}
    </div>
  );
}
