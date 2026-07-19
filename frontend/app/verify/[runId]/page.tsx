"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { VerificationResult } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { motion } from "framer-motion";
import {
  ShieldCheck, ShieldAlert, ShieldX,
  ExternalLink, CheckCircle2, XCircle,
  Copy, Check, Link2, Wallet
} from "lucide-react";

const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
const stellarTxUrl = (tx: string) => `https://stellar.expert/explorer/${STELLAR_NETWORK === "mainnet" ? "public" : "testnet"}/tx/${tx}`;

export default function VerifyPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.verifyRun(runId)
      .then(setResult)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [runId]);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig = {
    verified: {
      icon: ShieldCheck,
      color: "text-[#007c89]",
      bg: "bg-[#d8f3f0]",
      border: "border-[#8fcac4]",
      label: "Verified",
      description: "This execution is cryptographically verified. The hash matches and is anchored on the Stellar blockchain.",
    },
    tampered: {
      icon: ShieldX,
      color: "text-[#a12a2a]",
      bg: "bg-[#fbe7e7]",
      border: "border-[#efb4b4]",
      label: "Tampered",
      description: "WARNING: The recomputed hash does not match the stored hash. This execution record may have been modified.",
    },
    unanchored: {
      icon: ShieldAlert,
      color: "text-[#8b5e00]",
      bg: "bg-[#fff4c4]",
      border: "border-[#e5c917]",
      label: "Unanchored",
      description: "Hash matches but no blockchain proof was found. This execution is not yet anchored on-chain.",
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f1e7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#241c15]/20 border-t-[#241c15] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#6b6257]">Verifying execution...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f1e7]">
        <Navbar />
        <div className="pt-32 text-center px-4">
          <ShieldX className="h-16 w-16 text-[#a12a2a] mx-auto mb-4" />
          <p className="text-[#a12a2a] text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const config = statusConfig[result.verification_status];
  const StatusIcon = config.icon;
  const stellarUrl = result.stellar_transaction ? stellarTxUrl(result.stellar_transaction) : null;

  return (
    <div className="min-h-screen bg-[#f6f1e7]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#241c15] mb-2">Execution Verification</h1>
            <p className="text-sm text-[#6b6257] font-mono">Run ID: {runId}</p>
          </div>

          {/* Status Banner */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`rounded-[24px] border ${config.border} ${config.bg} p-8 text-center mb-8`}
          >
            <StatusIcon className={`h-16 w-16 ${config.color} mx-auto mb-4`} />
            <h2 className={`text-3xl font-bold ${config.color} mb-2`}>{config.label}</h2>
            <p className="text-[#6b6257] max-w-md mx-auto">{config.description}</p>
          </motion.div>

          {/* Verification Details */}
          <div className="space-y-4">
            {/* Hash Comparison */}
            <div className="rounded-[24px] border border-[#d9cfba] bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#e7ddc6]">
                <span className="text-sm font-medium text-[#403b33]">Hash Comparison</span>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-[#6b6257] mb-1">Stored Hash</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-[#6b6257] font-mono break-all">{result.stored_hash || "None"}</code>
                    {result.stored_hash && (
                      <button onClick={() => copyHash(result.stored_hash!)} className="shrink-0 p-1 text-[#8a8175] hover:text-[#241c15]">
                        {copied ? <Check className="h-3 w-3 text-[#007c89]" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#6b6257] mb-1">Recomputed Hash</p>
                  <code className="text-xs text-[#6b6257] font-mono break-all">{result.computed_hash}</code>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-[#e7ddc6]">
                  {result.hashes_match ? (
                    <span className="flex items-center gap-1 text-sm text-[#007c89]">
                      <CheckCircle2 className="h-4 w-4" /> Hashes Match
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-[#a12a2a]">
                      <XCircle className="h-4 w-4" /> Hashes Do Not Match
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Blockchain Proof */}
            <div className={`rounded-[20px] border overflow-hidden ${
              result.stellar_verified
                ? "border-[#8fcac4] bg-[#d8f3f0]"
                : "border-[#e5c917] bg-[#fff4c4]"
            }`}>
              <div className="px-5 py-3 border-b border-[#e7ddc6] flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[#403b33]">Stellar Testnet Proof</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                  result.stellar_verified
                    ? "bg-[#d8f3f0] text-[#004e56]"
                    : "bg-[#fff4c4] text-[#8b5e00]"
                }`}>
                  {result.stellar_verified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                  {result.stellar_verified ? "Anchored on-chain" : "No verified anchor"}
                </span>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <p className="text-xs text-[#6b6257] mb-1">Blockchain Transaction ID</p>
                  {result.stellar_transaction ? (
                    <div className="space-y-3">
                      <code className="block rounded-lg border border-[#d9cfba] bg-[#f6f1e7] p-3 text-xs text-[#004e56] font-mono break-all">
                        {result.stellar_transaction}
                      </code>
                      <a
                        href={stellarUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-[#8fcac4] px-3 py-2 text-sm text-[#004e56] hover:bg-[#d8f3f0] transition-all"
                      >
                        <Link2 className="h-4 w-4" />
                        Open proof on Stellar Expert
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-[#8b5e00]">No Stellar transaction was stored for this run.</p>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-[#e7ddc6]">
                  {result.stellar_verified ? (
                    <span className="flex items-center gap-1 text-sm text-[#007c89]">
                      <CheckCircle2 className="h-4 w-4" /> Stellar transaction exists and its memo matches this run hash
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-[#8b5e00]">
                      <XCircle className="h-4 w-4" /> This run is not verified on Stellar yet
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Execution Summary */}
            <div className="rounded-[24px] border border-[#d9cfba] bg-white shadow-sm p-5">
              <h3 className="text-sm font-medium text-[#403b33] mb-3">Execution Summary</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#6b6257]">Agent</p>
                  <p className="text-[#241c15]">{result.run_details.agent_name || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6257]">Status</p>
                  <p className={result.run_details.status === "success" ? "text-[#007c89]" : "text-[#a12a2a]"}>
                    {result.run_details.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6257]">Execution Time</p>
                  <p className="text-[#241c15]">{result.run_details.execution_time?.toFixed(3)}s</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6257]">Timestamp</p>
                  <p className="text-[#241c15]">{new Date(result.run_details.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* User Wallet */}
            <div className="rounded-[24px] border border-[#d9cfba] bg-white shadow-sm p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#403b33]">
                <Wallet className="h-4 w-4 text-[#007c89]" />
                User Stellar Wallet
              </h3>
              {result.run_details.user_stellar_wallet_address ? (
                <div className="space-y-2">
                  <code className="block break-all rounded-lg border border-[#d9cfba] bg-[#f6f1e7] p-3 text-xs text-[#004e56] font-mono">
                    {result.run_details.user_stellar_wallet_address}
                  </code>
                  <p className="text-xs text-[#6b6257] capitalize">
                    Connected wallet network: {result.run_details.user_stellar_wallet_network || "testnet"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[#6b6257]">No user wallet was connected for this run.</p>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
