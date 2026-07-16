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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

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
      <div id="execute-native-root" className="min-h-screen bg-[#060612] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  const apiBase = ${JSON.stringify(API_BASE)};
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const token = () => { try { return localStorage.getItem("access_token"); } catch { return null; } };
  const req = async (path, opts = {}) => {
    const t = token();
    const r = await fetch(apiBase + path, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}), ...(opts.headers || {}) },
    });
    const p = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(p.detail || "Request failed");
    return p;
  };
  const setup = async () => {
    const root = document.getElementById("execute-native-root");
    if (!root) return;
    await new Promise(r => setTimeout(r, 1200));
    if (document.querySelector("h1")) return;
    const id = location.pathname.split("/").filter(Boolean).at(-2);
    let agent;
    try { agent = await req("/agents/" + encodeURIComponent(id)); }
    catch { root.innerHTML = '<p class="text-gray-500">Agent not found</p>'; return; }
    root.className = "min-h-screen bg-[#060612] text-white";
    root.innerHTML = \`
      <nav class="border-b border-white/10"><div class="max-w-6xl mx-auto h-16 px-4 flex items-center justify-between"><a href="/" class="font-bold">AgentTrust</a><a href="/agents/\${agent.id}" class="text-cyan-400 text-sm">View Details</a></div></nav>
      <main class="pt-10 pb-16 px-4 max-w-4xl mx-auto">
        <div class="rounded-xl border border-white/10 bg-white/[0.02] p-5 mb-6">
          <h2 class="text-lg font-semibold">\${esc(agent.name)}</h2><p class="text-sm text-gray-500">\${esc(agent.provider)} / \${esc(agent.model)}</p>
        </div>
        <h1 class="text-2xl font-bold mb-6">Execute Agent</h1>
        \${token() ? \`
          <label class="block text-sm text-gray-300 mb-2">Your Task</label>
          <textarea id="native-task" rows="6" class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white resize-none" placeholder="Describe the task..."></textarea>
          <button id="native-execute" class="mt-4 px-8 py-3 rounded-xl bg-cyan-500 text-white font-semibold">Execute</button>
          <div id="native-result" class="mt-6"></div>
        \` : \`
          <div class="rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center"><p class="text-amber-400 mb-4">You need to sign in to execute agents</p><a href="/login" class="inline-flex px-6 py-3 rounded-xl bg-cyan-500 text-white">Sign In</a></div>
        \`}
      </main>
    \`;
    document.getElementById("native-execute")?.addEventListener("click", async () => {
      const task = document.getElementById("native-task")?.value?.trim();
      const out = document.getElementById("native-result");
      if (!task || !out) return;
      out.innerHTML = '<p class="text-cyan-400">Executing...</p>';
      try {
        const run = await req("/execute", { method: "POST", body: JSON.stringify({ agent_id: id, task }) });
        out.innerHTML = \`
          <div class="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <p class="text-sm \${run.status === "success" ? "text-emerald-400" : "text-red-400"}">\${esc(run.status)}</p>
            <pre class="mt-4 whitespace-pre-wrap text-sm text-gray-300 font-sans">\${esc(run.response)}</pre>
            <a href="/runs/\${run.id}" class="inline-block mt-4 text-cyan-400 text-sm">View Full Details</a>
          </div>\`;
      } catch (e) {
        out.innerHTML = '<p class="text-red-400">' + esc(e.message || "Execution failed") + '</p>';
      }
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true }); else setup();
})();
            `,
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060612]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
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
                  initial={false}
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

                  {/* Action Log */}
                  {result.action_log && result.action_log.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                        <Bot className="h-4 w-4 text-cyan-400" />
                        <span className="text-sm font-medium text-gray-300">Recorded Actions</span>
                      </div>
                      <div className="p-5 space-y-3">
                        {result.action_log.map((item, index) => (
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
