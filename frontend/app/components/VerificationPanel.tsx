"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  ExternalLink,
  HardDrive,
  Shield,
  XCircle,
} from "lucide-react";

interface ActionLogItem {
  step: number;
  action: string;
  target: string;
  status: string;
  note: string;
}

interface VerificationPanelProps {
  status: string;
  exitCode: number;
  executionTime: number;
  evidenceHash: string;
  stellarTxId: string | null;
  actionLog: ActionLogItem[];
}

export default function VerificationPanel({
  status,
  exitCode,
  executionTime,
  evidenceHash,
  stellarTxId,
  actionLog,
}: VerificationPanelProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!isMounted) {
    return <div className="animate-pulse bg-[#0b112c] h-96 rounded-xl border border-gray-800" />;
  }

  const isSuccess = status === "success" && exitCode === 0;
  const stellarUrl = stellarTxId
    ? `https://stellar.expert/explorer/testnet/tx/${stellarTxId}`
    : null;

  return (
    <div className="bg-[#0b112c] border border-gray-800 rounded-xl p-6 space-y-6 text-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <Shield className={`h-6 w-6 ${isSuccess ? "text-emerald-400" : "text-rose-400"}`} />
          <div>
            <h3 className="text-lg font-semibold text-white">Execution Integrity Sandbox Report</h3>
            <p className="text-xs text-gray-400">Decoupled Worker Node Telemetry</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-[#131b3e] px-4 py-2 rounded-lg border border-gray-700">
          <div className="text-right">
            <span className="block text-xs text-gray-400 uppercase tracking-wider font-medium">Metrics</span>
            <span className="text-xs font-mono text-emerald-400">{executionTime.toFixed(3)}s lifespan</span>
          </div>
          <div className="border-l border-gray-700 h-6 mx-1" />
          <div>
            <span className="block text-xs text-gray-400 uppercase tracking-wider font-medium">Exit Code</span>
            <span className={`text-xs font-mono block ${exitCode === 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {exitCode}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-[#070b1e] rounded-lg p-4 border border-gray-800 space-y-3">
        <div>
          <span className="block text-xs font-medium text-gray-400 mb-1">SHA-256 Evidence Immutable Hash</span>
          <div className="font-mono text-xs bg-[#111827] p-2 rounded border border-gray-800 break-all text-blue-400">
            {evidenceHash || "Computation missing or tracking array corrupted"}
          </div>
        </div>
        <div>
          <span className="block text-xs font-medium text-gray-400 mb-1">Stellar Testnet Transaction Anchor Proof</span>
          {stellarUrl && stellarTxId ? (
            <a
              href={stellarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-emerald-400 hover:underline"
            >
              {stellarTxId.substring(0, 24)}...
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-xs text-amber-400 italic">Pending blockchain serialization loop entry...</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-blue-400" />
          Normalized Runtime Action Checklist
        </h4>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {actionLog.length > 0 ? (
            actionLog.map((log, idx) => (
              <div
                key={`${log.step}-${log.action}-${idx}`}
                className="flex items-start gap-3 bg-[#0d153a] p-3 rounded-lg border border-gray-800 text-xs"
              >
                {log.status === "success" ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1 w-full">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-white font-medium">
                      Step {log.step}: {log.action}
                    </span>
                    <span className="bg-[#1e293b] px-2 py-0.5 rounded text-[10px] text-gray-400 font-mono">
                      target: {log.target}
                    </span>
                  </div>
                  <p className="text-gray-400 text-[11px] leading-relaxed">{log.note}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-[#0d153a] p-3 rounded-lg border border-gray-800 text-xs text-gray-400">
              No normalized action log was captured for this run.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
