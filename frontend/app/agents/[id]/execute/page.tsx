"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Agent, Run } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { motion } from "framer-motion";
import {
  Send, Bot, Clock, CheckCircle2, XCircle, Hash,
  FileText, ArrowRight, Loader2, Shield
} from "lucide-react";

export default function ExecuteAgentPage() {
  const params = useParams();
  const id = params.id as string;
  const { isAuthenticated } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [task, setTask] = useState("");
  const [result, setResult] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAgent(id).then(setAgent).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleExecute = async () => {
    if (!task.trim()) return;
    setExecuting(true);
    setError("");
    setResult(null);
    try {
      const run = await api.execute({ agent_id: id, task });
      setResult(run);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Execution failed"));
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060612] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060612]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Agent mini card */}
          {agent && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                <Bot className="h-6 w-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">{agent.name}</h2>
                <p className="text-sm text-gray-500">{agent.provider} / {agent.model}</p>
              </div>
              <Link href={`/agents/${agent.id}`} className="text-sm text-cyan-400 hover:text-cyan-300">
                View Details
              </Link>
            </div>
          )}

          <h1 className="text-2xl font-bold text-white mb-6">Execute Agent</h1>

          {!isAuthenticated ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
              <p className="text-amber-400 mb-4">You need to sign in to execute agents</p>
              <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium">
                Sign In <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <>
              {/* Task input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Your Task</label>
                <textarea
                  id="task-input"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  rows={6}
                  placeholder="Describe the task you want the agent to perform..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all resize-none"
                />
              </div>

              <button
                id="execute-btn"
                onClick={handleExecute}
                disabled={executing || !task.trim()}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25"
              >
                {executing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Execute
                  </>
                )}
              </button>

              {/* Error */}
              {error && (
                <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Result */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 space-y-4"
                >
                  {/* Execution metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                        result.status === "success" ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {result.status === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {result.status}
                      </span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                      <span className="text-sm text-gray-400 flex items-center justify-center gap-1">
                        <Clock className="h-4 w-4" /> {result.execution_time?.toFixed(2)}s
                      </span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                      <span className="text-sm text-gray-400 flex items-center justify-center gap-1 font-mono">
                        <Hash className="h-4 w-4" /> {result.hash?.slice(0, 12)}...
                      </span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                      {result.stellar_transaction ? (
                        <span className="text-sm text-cyan-400 flex items-center justify-center gap-1">
                          <Shield className="h-4 w-4" /> On-chain
                        </span>
                      ) : (
                        <span className="text-sm text-gray-600">Pending anchor</span>
                      )}
                    </div>
                  </div>

                  {/* Response */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm font-medium text-gray-300">Agent Response</span>
                    </div>
                    <div className="p-5">
                      <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed font-sans">
                        {result.response}
                      </pre>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="flex gap-3">
                    <Link
                      href={`/runs/${result.id}`}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all"
                    >
                      View Full Details <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/verify/${result.id}`}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-cyan-500/20 text-sm text-cyan-400 hover:bg-cyan-500/5 transition-all"
                    >
                      <Shield className="h-4 w-4" /> Verify Execution
                    </Link>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
