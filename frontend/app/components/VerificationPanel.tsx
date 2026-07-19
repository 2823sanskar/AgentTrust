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
    return <div className="animate-pulse bg-white h-96 rounded-[24px] border border-[#d9cfba]" />;
  }

  const isSuccess = status === "success" && exitCode === 0;
  const stellarUrl = stellarTxId
    ? `https://stellar.expert/explorer/testnet/tx/${stellarTxId}`
    : null;

  return (
    <div className="bg-white border border-[#d9cfba] rounded-[24px] p-6 space-y-6 text-[#241c15] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e7ddc6] pb-4">
        <div className="flex items-center gap-3">
          <Shield className={`h-6 w-6 ${isSuccess ? "text-[#007c89]" : "text-red-700"}`} />
          <div>
            <h3 className="text-lg font-semibold text-[#241c15]">Execution Integrity Sandbox Report</h3>
            <p className="text-xs text-[#6b6257]">Decoupled Worker Node Telemetry</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-[#f6f1e7] px-4 py-2 rounded-[24px] border border-[#d9cfba]">
          <div className="text-right">
            <span className="block text-xs text-[#6b6257] uppercase font-medium">Metrics</span>
            <span className="text-xs font-mono text-[#004e56]">{executionTime.toFixed(3)}s lifespan</span>
          </div>
          <div className="border-l border-[#d9cfba] h-6 mx-1" />
          <div>
            <span className="block text-xs text-[#6b6257] uppercase font-medium">Exit Code</span>
            <span className={`text-xs font-mono block ${exitCode === 0 ? "text-[#004e56]" : "text-red-700"}`}>
              {exitCode}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-[#f6f1e7] rounded-[24px] p-4 border border-[#d9cfba] space-y-3">
        <div>
          <span className="block text-xs font-medium text-[#6b6257] mb-1">SHA-256 Evidence Immutable Hash</span>
          <div className="font-mono text-xs bg-white p-3 rounded-[20px] border border-[#d9cfba] break-all text-[#241c15]">
            {evidenceHash || "Computation missing or tracking array corrupted"}
          </div>
        </div>
        <div>
          <span className="block text-xs font-medium text-[#6b6257] mb-1">Stellar Testnet Transaction Anchor Proof</span>
          {stellarUrl && stellarTxId ? (
            <a
              href={stellarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#241c15] bg-[#ffe01b] px-3 py-2 font-mono text-xs text-[#241c15] hover:bg-[#f6d90b]"
            >
              {stellarTxId.substring(0, 24)}...
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-xs text-[#8b5e00] italic">Pending blockchain serialization loop entry...</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[#241c15] flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-[#007c89]" />
          Normalized Runtime Action Checklist
        </h4>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {actionLog.length > 0 ? (
            actionLog.map((log, idx) => (
              <div
                key={`${log.step}-${log.action}-${idx}`}
                className="flex items-start gap-3 bg-[#f6f1e7] p-3 rounded-[24px] border border-[#d9cfba] text-xs"
              >
                {log.status === "success" ? (
                  <CheckCircle className="h-4 w-4 text-[#007c89] mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1 w-full">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[#241c15] font-medium">
                      Step {log.step}: {log.action}
                    </span>
                    <span className="bg-white px-2 py-0.5 rounded-full border border-[#d9cfba] text-[10px] text-[#6b6257] font-mono">
                      target: {log.target}
                    </span>
                  </div>
                  <p className="text-[#6b6257] text-[11px] leading-relaxed">{log.note}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-[#f6f1e7] p-3 rounded-[24px] border border-[#d9cfba] text-xs text-[#6b6257]">
              No normalized action log was captured for this run.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
