"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Agent, Run } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { AgentCard } from "@/components/agents/agent-card";
import { motion } from "framer-motion";
import {
  Bot,
  Activity,
  Shield,
  CheckCircle2,
  Clock,
  Hash,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAgents: 0,
    totalRuns: 0,
    avgTrust: 0,
    verifiedRuns: 0,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const [agentsRes, runsRes] = await Promise.all([
          api.getAgents({ page_size: 50 }),
          api.getRuns({ user_id: user.id, page_size: 10 }),
        ]);

        const myAgents = agentsRes.agents.filter((a) => a.developer_id === user.id);
        setAgents(myAgents);
        setRuns(runsRes.runs);

        const avgTrust = myAgents.length > 0
          ? myAgents.reduce((sum, a) => sum + (a.trust_score || 0), 0) / myAgents.length
          : 0;
        const verified = runsRes.runs.filter((r) => r.stellar_transaction).length;

        setStats({
          totalAgents: myAgents.length,
          totalRuns: runsRes.total,
          avgTrust: Math.round(avgTrust),
          verifiedRuns: verified,
        });
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#060612] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060612]">
      <Navbar />
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white">
            Welcome back, {user?.name}
          </h1>
          <p className="text-gray-500 mt-1">Here&apos;s your AgentTrust overview</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="My Agents" value={stats.totalAgents} icon={Bot} color="cyan" />
          <StatCard label="Total Executions" value={stats.totalRuns} icon={Activity} color="purple" />
          <StatCard label="Avg Trust Score" value={stats.avgTrust} icon={Shield} color="emerald" />
          <StatCard label="Verified Runs" value={stats.verifiedRuns} icon={CheckCircle2} color="amber" />
        </div>

        {/* My Agents */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">My Agents</h2>
            <Link
              href="/agents/register"
              className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              Register New <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {agents.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
              <Bot className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No agents registered yet</p>
              <Link
                href="/agents/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:from-cyan-400 hover:to-blue-500 transition-all"
              >
                Register Your First Agent
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Runs */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Recent Executions</h2>
          {runs.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
              <Activity className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">No executions yet. Run an agent to see results here.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Run ID</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Agent</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Time</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Hash</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {runs.map((run) => (
                      <tr key={run.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/runs/${run.id}`} className="text-sm text-cyan-400 hover:text-cyan-300 font-mono">
                            {run.id.slice(0, 8)}...
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300">{run.agent_name || "—"}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            run.status === "success"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}>
                            {run.status === "success" ? <CheckCircle2 className="h-3 w-3" /> : null}
                            {run.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {run.execution_time?.toFixed(2)}s
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-mono text-gray-600">
                            {run.hash ? `${run.hash.slice(0, 12)}...` : "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {run.stellar_transaction ? (
                            <span className="inline-flex items-center gap-1 text-xs text-cyan-400">
                              <Hash className="h-3 w-3" />
                              On-chain
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
