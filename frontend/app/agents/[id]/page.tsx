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
      <div className="min-h-screen bg-[#f6f1e7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#8fcac4] border-t-[#007c89] rounded-full animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-[#f6f1e7]">
        <Navbar />
        <div className="pt-32 text-center">
          <p className="text-[#6b6257] text-lg">Agent not found</p>
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
    external_docker: "from-emerald-500 to-teal-500",
  };

  const agentTypeLabel: Record<string, string> = {
    prebuilt: "Prebuilt",
    custom_docker: "Custom Docker",
    custom_script: "Custom Script",
  };

  return (
    <div className="min-h-screen bg-[#f6f1e7]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          {/* Agent Header */}
          <div className="rounded-[24px] border border-[#d9cfba] bg-white p-8 mb-6">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${providerColors[agent.provider] || "bg-[#f6f1e7] text-[#6b6257] border-[#d9cfba]"}`}>
                    <Zap className="h-3 w-3" />
                    {agent.provider.toUpperCase()}
                  </div>
                  <span className="text-xs text-[#6b6257] flex items-center gap-1">
                    <Bot className="h-3 w-3" /> {agent.model}
                  </span>
                  <span className="rounded-full bg-[#f6f1e7] px-2 py-0.5 text-xs font-medium text-[#6b6257]">
                    {agentTypeLabel[agent.agent_type] || agent.agent_type}
                  </span>
                </div>
                <h1 className="text-3xl font-bold text-[#241c15] mb-2">{agent.name}</h1>
                <p className="text-[#6b6257] mb-4">{agent.description || "No description"}</p>
                {agent.provider === "external_docker" && (
                  <div className="mb-4 grid gap-2 text-xs text-[#6b6257] sm:grid-cols-2">
                    <code className="rounded-lg border border-[#d9cfba] bg-black/20 px-3 py-2">
                      image: {agent.docker_image}
                    </code>
                    <code className="rounded-lg border border-[#d9cfba] bg-black/20 px-3 py-2">
                      timeout: {agent.timeout_seconds || 60}s
                    </code>
                    <code className="rounded-lg border border-[#d9cfba] bg-black/20 px-3 py-2">
                      entrypoint: {agent.entrypoint_command || agent.docker_command || "image CMD"}
                    </code>
                    {agent.source_repo_url && (
                      <code className="rounded-lg border border-[#d9cfba] bg-black/20 px-3 py-2">
                        repo: {agent.source_repo_url}
                      </code>
                    )}
                    {agent.required_env_vars && agent.required_env_vars.length > 0 && (
                      <div className="rounded-lg border border-[#d9cfba] bg-black/20 px-3 py-2 sm:col-span-2">
                        env: {agent.required_env_vars.join(", ")}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-4 text-sm text-[#6b6257]">
                  <span className="flex items-center gap-1"><User className="h-4 w-4" /> {agent.developer_name}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(agent.created_at).toLocaleDateString()}</span>
                  {agent.category && <span className="px-2 py-0.5 rounded-full bg-white text-xs">{agent.category}</span>}
                </div>
              </div>
              <div className="flex flex-col items-center gap-4">
                <TrustBadge score={agent.trust_score || 0} size="lg" />
                <Link
                  href={`/agents/${agent.id}/execute`}
                  className="flex items-center gap-2 px-6 py-3 rounded-[20px] bg-[#ffe01b] border border-[#241c15] text-[#241c15] font-semibold hover:bg-[#f6d90b] transition-all shadow-lg shadow-black/10"
                >
                  Execute Agent <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Trust Breakdown */}
          {trust && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-[20px] border border-[#d9cfba] bg-white p-5 text-center">
                <BarChart3 className="h-5 w-5 text-[#007c89] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[#241c15]">{(trust.success_rate * 100).toFixed(1)}%</p>
                <p className="text-xs text-[#6b6257]">Success Rate</p>
              </div>
              <div className="rounded-[20px] border border-[#d9cfba] bg-white p-5 text-center">
                <Clock className="h-5 w-5 text-[#007c89] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[#241c15]">{trust.average_latency.toFixed(2)}s</p>
                <p className="text-xs text-[#6b6257]">Avg Latency</p>
              </div>
              <div className="rounded-[20px] border border-[#d9cfba] bg-white p-5 text-center">
                <Shield className="h-5 w-5 text-[#8b5e00] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[#241c15]">{trust.verified_runs}</p>
                <p className="text-xs text-[#6b6257]">Verified Runs</p>
              </div>
              <div className="rounded-[20px] border border-[#d9cfba] bg-white p-5 text-center">
                <Activity className="h-5 w-5 text-[#8b5e00] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[#241c15]">{trust.total_runs}</p>
                <p className="text-xs text-[#6b6257]">Total Runs</p>
              </div>
            </div>
          )}

          {/* Execution History */}
          <div className="rounded-[24px] border border-[#d9cfba] bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e7ddc6]">
              <h2 className="text-lg font-semibold text-[#241c15]">Execution History</h2>
            </div>
            {runs.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="h-12 w-12 text-gray-700 mx-auto mb-4" />
                <p className="text-[#6b6257]">No executions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e7ddc6]">
                      <th className="text-left text-xs font-medium text-[#6b6257] uppercase px-6 py-3">Run ID</th>
                      <th className="text-left text-xs font-medium text-[#6b6257] uppercase px-6 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-[#6b6257] uppercase px-6 py-3">Time</th>
                      <th className="text-left text-xs font-medium text-[#6b6257] uppercase px-6 py-3">Date</th>
                      <th className="text-left text-xs font-medium text-[#6b6257] uppercase px-6 py-3">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e7ddc6]">
                    {runs.map((run) => (
                      <tr key={run.id} className="hover:bg-white">
                        <td className="px-6 py-4">
                          <Link href={`/runs/${run.id}`} className="text-sm text-[#007c89] hover:text-[#004e56] font-mono">
                            {run.id.slice(0, 8)}...
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            run.status === "success" ? "bg-[#d8f3f0] text-[#007c89]" : "bg-[#fbe7e7] text-[#a12a2a]"
                          }`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6b6257]">{run.execution_time?.toFixed(2)}s</td>
                        <td className="px-6 py-4 text-sm text-[#6b6257]">{new Date(run.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          {run.stellar_transaction ? (
                            <span className="text-xs text-[#007c89] flex items-center gap-1"><Hash className="h-3 w-3" /> On-chain</span>
                          ) : (
                            <span className="text-xs text-[#8a8175]">-</span>
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
