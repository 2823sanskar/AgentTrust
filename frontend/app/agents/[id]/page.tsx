"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Agent, TrustScore, Run } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { TrustBadge } from "@/components/shared/trust-badge";
import { motion } from "framer-motion";
import {
  Bot, Zap, Clock, Hash, ArrowRight,
  User, Calendar, BarChart3, Shield, Activity
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [trust, setTrust] = useState<TrustScore | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [agentRes, runsRes] = await Promise.all([
          api.getAgent(id),
          api.getRuns({ agent_id: id, page_size: 10 }),
        ]);
        setAgent(agentRes);
        setRuns(runsRes.runs);
        try { const t = await api.getTrustScore(id); setTrust(t); } catch {}
      } catch (err) {
        console.error("Failed to load agent:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div id="agent-detail-native-root" className="min-h-screen bg-[#060612] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  if (window.__agentTrustAgentDetailFallbackInstalled) return;
  window.__agentTrustAgentDetailFallbackInstalled = true;
  const apiBase = ${JSON.stringify(API_BASE)};
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
  const formatDate = (value) => {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return "";
    }
  };
  const request = async (path) => {
    const response = await fetch(apiBase + path);
    if (!response.ok) throw new Error("Request failed");
    return response.json();
  };
  const renderNotFound = (root) => {
    root.className = "min-h-screen bg-[#060612] text-white";
    root.innerHTML = \`
      <nav class="border-b border-white/10 bg-[#060612]/95">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" class="text-lg font-bold text-white">AgentTrust</a>
          <a href="/agents" class="text-sm text-cyan-400">Agents</a>
        </div>
      </nav>
      <main class="pt-32 text-center">
        <p class="text-gray-500 text-lg">Agent not found</p>
      </main>
    \`;
  };
  const render = (root, agent, trust, runsRes) => {
    const runs = runsRes.runs || [];
    const providerClass = {
      groq: "from-orange-500 to-red-500",
      openai: "from-emerald-500 to-teal-500",
      gemini: "from-blue-500 to-purple-500",
      openrouter: "from-violet-500 to-fuchsia-500",
      browser: "from-cyan-500 to-sky-500",
    }[agent.provider] || "from-cyan-500 to-blue-500";
    root.className = "min-h-screen bg-[#060612] text-white";
    root.innerHTML = \`
      <nav class="border-b border-white/10 bg-[#060612]/95">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" class="text-lg font-bold text-white">AgentTrust</a>
          <div class="flex items-center gap-4 text-sm">
            <a href="/agents" class="text-gray-400 hover:text-white">Agents</a>
            <a href="/dashboard" class="text-gray-400 hover:text-white">Dashboard</a>
          </div>
        </div>
      </nav>
      <main class="pt-10 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <section class="rounded-2xl border border-white/10 bg-white/[0.02] p-8 mb-6">
          <div class="flex flex-col md:flex-row md:items-start gap-6">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-3">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r \${providerClass} text-white">\${escapeHtml(agent.provider).toUpperCase()}</span>
                <span class="text-xs text-gray-500">\${escapeHtml(agent.model)}</span>
              </div>
              <h1 class="text-3xl font-bold text-white mb-2">\${escapeHtml(agent.name)}</h1>
              <p class="text-gray-400 mb-4">\${escapeHtml(agent.description || "No description")}</p>
              <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <span>By \${escapeHtml(agent.developer_name || "Unknown")}</span>
                <span>\${formatDate(agent.created_at)}</span>
                \${agent.category ? \`<span class="px-2 py-0.5 rounded-full bg-white/5 text-xs">\${escapeHtml(agent.category)}</span>\` : ""}
              </div>
            </div>
            <div class="flex flex-col items-start md:items-center gap-4">
              <div class="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center min-w-32">
                <p class="text-3xl font-bold text-cyan-400">\${Math.round(agent.trust_score || 0)}</p>
                <p class="text-xs text-gray-500">Trust Score</p>
              </div>
              <a href="/agents/\${agent.id}/execute" class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold">Execute Agent</a>
            </div>
          </div>
        </section>
        \${trust ? \`
          <section class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center"><p class="text-2xl font-bold text-white">\${(trust.success_rate * 100).toFixed(1)}%</p><p class="text-xs text-gray-500">Success Rate</p></div>
            <div class="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center"><p class="text-2xl font-bold text-white">\${trust.average_latency.toFixed(2)}s</p><p class="text-xs text-gray-500">Avg Latency</p></div>
            <div class="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center"><p class="text-2xl font-bold text-white">\${trust.verified_runs}</p><p class="text-xs text-gray-500">Verified Runs</p></div>
            <div class="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center"><p class="text-2xl font-bold text-white">\${trust.total_runs}</p><p class="text-xs text-gray-500">Total Runs</p></div>
          </section>
        \` : ""}
        <section class="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div class="px-6 py-4 border-b border-white/5">
            <h2 class="text-lg font-semibold text-white">Execution History</h2>
          </div>
          \${runs.length ? \`
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-white/5">
                    <th class="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Run ID</th>
                    <th class="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
                    <th class="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Time</th>
                    <th class="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Date</th>
                    <th class="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Proof</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  \${runs.map((run) => \`
                    <tr class="hover:bg-white/[0.02]">
                      <td class="px-6 py-4"><a href="/runs/\${run.id}" class="text-sm text-cyan-400 font-mono">\${escapeHtml(String(run.id).slice(0, 8))}...</a></td>
                      <td class="px-6 py-4"><span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium \${run.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}">\${escapeHtml(run.status)}</span></td>
                      <td class="px-6 py-4 text-sm text-gray-500">\${Number(run.execution_time || 0).toFixed(2)}s</td>
                      <td class="px-6 py-4 text-sm text-gray-500">\${formatDate(run.created_at)}</td>
                      <td class="px-6 py-4">\${run.stellar_transaction ? '<span class="text-xs text-cyan-400">On-chain</span>' : '<span class="text-xs text-gray-600">Pending</span>'}</td>
                    </tr>
                  \`).join("")}
                </tbody>
              </table>
            </div>
          \` : \`
            <div class="p-12 text-center">
              <p class="text-gray-500">No executions yet</p>
            </div>
          \`}
        </section>
      </main>
    \`;
  };
  const setup = async () => {
    const root = document.getElementById("agent-detail-native-root");
    if (!root) return;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    if (document.querySelector("h1")) return;
    const id = window.location.pathname.split("/").filter(Boolean).pop();
    if (!id) {
      renderNotFound(root);
      return;
    }
    try {
      const [agent, runsRes] = await Promise.all([
        request("/agents/" + encodeURIComponent(id)),
        request("/runs?agent_id=" + encodeURIComponent(id) + "&page_size=10"),
      ]);
      let trust = null;
      try {
        trust = await request("/trust/" + encodeURIComponent(id));
      } catch {}
      render(root, agent, trust, runsRes);
    } catch {
      renderNotFound(root);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true });
  else setup();
})();
            `,
          }}
        />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-[#060612]">
        <Navbar />
        <div className="pt-32 text-center">
          <p className="text-gray-500 text-lg">Agent not found</p>
        </div>
      </div>
    );
  }

  const providerColors: Record<string, string> = {
    groq: "from-orange-500 to-red-500",
    openai: "from-emerald-500 to-teal-500",
    gemini: "from-blue-500 to-purple-500",
    openrouter: "from-violet-500 to-fuchsia-500",
    browser: "from-cyan-500 to-sky-500",
  };

  return (
    <div className="min-h-screen bg-[#060612]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          {/* Agent Header */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 mb-6">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${providerColors[agent.provider]} text-white`}>
                    <Zap className="h-3 w-3" />
                    {agent.provider.toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Bot className="h-3 w-3" /> {agent.model}
                  </span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">{agent.name}</h1>
                <p className="text-gray-400 mb-4">{agent.description || "No description"}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><User className="h-4 w-4" /> {agent.developer_name}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(agent.created_at).toLocaleDateString()}</span>
                  {agent.category && <span className="px-2 py-0.5 rounded-full bg-white/5 text-xs">{agent.category}</span>}
                </div>
              </div>
              <div className="flex flex-col items-center gap-4">
                <TrustBadge score={agent.trust_score || 0} size="lg" />
                <Link
                  href={`/agents/${agent.id}/execute`}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25"
                >
                  Execute Agent <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Trust Breakdown */}
          {trust && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
                <BarChart3 className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{(trust.success_rate * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-500">Success Rate</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
                <Clock className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{trust.average_latency.toFixed(2)}s</p>
                <p className="text-xs text-gray-500">Avg Latency</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
                <Shield className="h-5 w-5 text-purple-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{trust.verified_runs}</p>
                <p className="text-xs text-gray-500">Verified Runs</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
                <Activity className="h-5 w-5 text-amber-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{trust.total_runs}</p>
                <p className="text-xs text-gray-500">Total Runs</p>
              </div>
            </div>
          )}

          {/* Execution History */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">Execution History</h2>
            </div>
            {runs.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="h-12 w-12 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500">No executions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Run ID</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Time</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {runs.map((run) => (
                      <tr key={run.id} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-4">
                          <Link href={`/runs/${run.id}`} className="text-sm text-cyan-400 hover:text-cyan-300 font-mono">
                            {run.id.slice(0, 8)}...
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            run.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                          }`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{run.execution_time?.toFixed(2)}s</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(run.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          {run.stellar_transaction ? (
                            <span className="text-xs text-cyan-400 flex items-center gap-1"><Hash className="h-3 w-3" /> On-chain</span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
