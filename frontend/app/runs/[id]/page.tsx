"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Run } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { motion } from "framer-motion";
import {
  FileText, Clock, CheckCircle2, XCircle,
  Shield, Bot, Calendar, ExternalLink, Copy, Check, Link2, Wallet
} from "lucide-react";

const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
const stellarTxUrl = (tx: string) => `https://stellar.expert/explorer/${STELLAR_NETWORK === "mainnet" ? "public" : "testnet"}/tx/${tx}`;

export default function RunDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getRun(id).then(setRun).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const copyHash = () => {
    if (run?.hash) {
      navigator.clipboard.writeText(run.hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const stellarUrl = run?.stellar_transaction ? stellarTxUrl(run.stellar_transaction) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060612] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-[#060612]">
        <Navbar />
        <div className="pt-32 text-center"><p className="text-gray-500">Run not found</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060612]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Execution Detail</h1>
              <p className="text-sm text-gray-500 font-mono mt-1">Run ID: {run.id}</p>
            </div>
            <Link
              href={`/verify/${run.id}`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-cyan-500/20 text-sm text-cyan-400 hover:bg-cyan-500/5 transition-all"
            >
              <Shield className="h-4 w-4" /> Verify
            </Link>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Bot className="h-3 w-3" /> Agent</p>
              <Link href={`/agents/${run.agent_id}`} className="text-sm text-cyan-400 hover:text-cyan-300">
                {run.agent_name || run.agent_id.slice(0, 8)}
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                {run.status === "success" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                Status
              </p>
              <span className={`text-sm font-medium ${run.status === "success" ? "text-emerald-400" : "text-red-400"}`}>
                {run.status}
              </span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Duration</p>
              <p className="text-sm text-white">{run.execution_time?.toFixed(3)}s</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</p>
              <p className="text-sm text-white">{new Date(run.created_at).toLocaleString()}</p>
            </div>
          </div>

          {/* Task */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-gray-300">Task Input</span>
            </div>
            <div className="p-5">
              <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans">{run.task}</pre>
            </div>
          </div>

          {/* Action Log */}
          {run.action_log && run.action_log.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <Bot className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-medium text-gray-300">Recorded Actions</span>
              </div>
              <div className="p-5 space-y-3">
                {run.action_log.map((item, index) => (
                  <div key={`${item.step}-${item.action}-${index}`} className="flex gap-3 rounded-lg bg-white/[0.02] p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-xs text-cyan-400">
                      {item.step}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-white">{item.action}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          item.status === "success"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : item.status === "failure"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-amber-500/10 text-amber-400"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="truncate text-xs text-gray-400">{item.target}</p>
                      <p className="text-xs text-gray-500">{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
              <Bot className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-gray-300">Agent Response</span>
            </div>
            <div className="p-5">
              <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans leading-relaxed">{run.response || "No response"}</pre>
            </div>
          </div>

          {(run.exit_code !== null || run.container_stdout || run.container_stderr) && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <Bot className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-medium text-gray-300">Docker Sandbox Evidence</span>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Exit Code</p>
                  <code className="text-sm text-white">{run.exit_code ?? "not captured"}</code>
                </div>
                {run.container_stdout && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">stdout</p>
                    <pre className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
                      {run.container_stdout}
                    </pre>
                  </div>
                )}
                {run.container_stderr && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">stderr</p>
                    <pre className="max-h-64 overflow-auto rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-200">
                      {run.container_stderr}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Blockchain Proof */}
          <div className={`rounded-xl border overflow-hidden ${
            stellarUrl
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-amber-500/20 bg-amber-500/5"
          }`}>
            <div className="px-5 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className={`h-4 w-4 ${stellarUrl ? "text-emerald-400" : "text-amber-400"}`} />
                <span className="text-sm font-medium text-white">Stellar Testnet Proof</span>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                stellarUrl
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-amber-500/10 text-amber-400"
              }`}>
                {stellarUrl ? "Anchored on-chain" : "Not anchored"}
              </span>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">SHA-256 Hash</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-cyan-400 font-mono break-all">{run.hash || "—"}</code>
                  {run.hash && (
                    <button onClick={copyHash} className="shrink-0 p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all">
                      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">Stellar Transaction ID</p>
                {stellarUrl && run.stellar_transaction ? (
                  <div className="space-y-3">
                    <code className="block break-all rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-emerald-300 font-mono">
                      {run.stellar_transaction}
                    </code>
                    <a
                      href={stellarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
                    >
                      <Link2 className="h-4 w-4" />
                      Open proof on Stellar Expert
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ) : (
                <p className="text-sm text-amber-300">No Stellar transaction was stored for this run.</p>
                )}
              </div>
              <div className="border-t border-white/5 pt-4">
                <p className="mb-2 flex items-center gap-1 text-xs text-gray-500">
                  <Wallet className="h-3.5 w-3.5" />
                  User Stellar Wallet
                </p>
                {run.user_stellar_wallet_address ? (
                  <div className="space-y-1">
                    <code className="block break-all rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-cyan-300 font-mono">
                      {run.user_stellar_wallet_address}
                    </code>
                    <p className="text-xs text-gray-500 capitalize">
                      Connected wallet network: {run.user_stellar_wallet_network || "testnet"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">This run was created without a connected Stellar wallet.</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
