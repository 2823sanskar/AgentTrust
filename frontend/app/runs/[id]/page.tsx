"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Run } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { motion } from "framer-motion";
import {
  FileText, Clock, CheckCircle2, XCircle, Hash,
  Shield, Bot, User, Calendar, ExternalLink, Copy, Check
} from "lucide-react";

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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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

          {/* Blockchain Proof */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 overflow-hidden">
            <div className="px-5 py-3 border-b border-cyan-500/10 flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-300">Blockchain Proof</span>
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
                <p className="text-xs text-gray-500 mb-1">Stellar Transaction</p>
                {run.stellar_transaction ? (
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-cyan-400 font-mono">{run.stellar_transaction.slice(0, 24)}...</code>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${run.stellar_transaction}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-cyan-400 transition-all"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Not yet anchored on-chain</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
