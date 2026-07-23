"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Agent, Run } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { AgentCard } from "@/components/agents/agent-card";
import CloudStatusBar from "@/app/components/CloudStatusBar";
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

function isCloudSandboxRun(run: Run) {
  const actionText = (run.action_log || [])
    .map((entry) => `${entry.action} ${entry.target} ${entry.note}`)
    .join(" ")
    .toLowerCase();
  const evidenceText = [
    run.container_stdout,
    run.container_stderr,
    run.response,
    actionText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    run.routing_mode === "cloud_sandbox" ||
    actionText.includes("routing_mode=cloud_sandbox") ||
    actionText.includes("cloud sandbox worker") ||
    evidenceText.includes("resource isolation boundary") ||
    evidenceText.includes("pull access denied for clawbot-demo")
  );
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
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
          api.getRuns({ page_size: 10 }),
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
      }
    };
    loadData();
  }, [user]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f6f1e7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#241c15]/20 border-t-[#241c15] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f1e7]">
      <Navbar />
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-[#241c15]">
            Welcome back, {user?.name}
          </h1>
          <p className="text-[#6b6257] mt-1">Track agents, sandbox runs, and Stellar proof from one clean workspace.</p>
        </motion.div>

        <div className="mb-6">
          <CloudStatusBar />
        </div>

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
            <h2 className="text-2xl font-semibold text-[#241c15]">My Agents</h2>
            <Link
              href="/agents/register"
              className="inline-flex items-center gap-1 rounded-full border border-[#241c15] bg-[#ffe01b] px-4 py-2 text-sm font-semibold text-[#241c15] hover:bg-[#f6d90b]"
            >
              Register New <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {agents.length === 0 ? (
            <div className="rounded-[24px] border border-[#d9cfba] bg-white p-12 text-center shadow-sm">
              <Bot className="h-12 w-12 text-[#b7aa8d] mx-auto mb-4" />
              <p className="text-[#6b6257] mb-4">No agents registered yet</p>
              <Link
                href="/agents/register"
                className="inline-flex items-center gap-2 rounded-full border border-[#241c15] bg-[#ffe01b] px-6 py-3 font-semibold text-[#241c15] transition-transform hover:-translate-y-0.5"
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
          <h2 className="text-2xl font-semibold text-[#241c15] mb-4">Recent Executions</h2>
          {runs.length === 0 ? (
            <div className="rounded-[24px] border border-[#d9cfba] bg-white p-12 text-center shadow-sm">
              <Activity className="h-12 w-12 text-[#b7aa8d] mx-auto mb-4" />
              <p className="text-[#6b6257]">No executions yet. Run an agent to see results here.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-[#d9cfba] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e7ddc6]">
                      <th className="text-left text-xs font-semibold text-[#6b6257] uppercase px-6 py-4">Run ID</th>
                      <th className="text-left text-xs font-semibold text-[#6b6257] uppercase px-6 py-4">Agent</th>
                      <th className="text-left text-xs font-semibold text-[#6b6257] uppercase px-6 py-4">Route</th>
                      <th className="text-left text-xs font-semibold text-[#6b6257] uppercase px-6 py-4">Status</th>
                      <th className="text-left text-xs font-semibold text-[#6b6257] uppercase px-6 py-4">Time</th>
                      <th className="text-left text-xs font-semibold text-[#6b6257] uppercase px-6 py-4">Hash</th>
                      <th className="text-left text-xs font-semibold text-[#6b6257] uppercase px-6 py-4">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e7ddc6]">
                    {runs.map((run) => {
                      const isCloudRun = isCloudSandboxRun(run);

                      return (
                      <tr key={run.id} className="hover:bg-[#fbf7ee] transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/runs/${run.id}`} className="text-sm text-[#007c89] hover:text-[#004e56] font-mono">
                            {run.id.slice(0, 8)}...
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#403b33]">{run.agent_name || "-"}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${
                            isCloudRun
                              ? "bg-[#d8f3f0] text-[#004e56] border-[#8fcac4]"
                              : "bg-[#f6f1e7] text-[#6b6257] border-[#d9cfba]"
                          }`}>
                            {isCloudRun ? "AWS Staging" : "Local Engine"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            run.status === "success"
                              ? "bg-[#d8f3f0] text-[#004e56] border border-[#8fcac4]"
                              : "bg-[#fbe7e7] text-[#a12a2a] border border-[#efb4b4]"
                          }`}>
                            {run.status === "success" ? <CheckCircle2 className="h-3 w-3" /> : null}
                            {run.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6b6257]">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {run.execution_time?.toFixed(2)}s
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-mono text-[#6b6257]">
                            {run.hash ? `${run.hash.slice(0, 12)}...` : "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {run.stellar_transaction ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#8fcac4] bg-[#d8f3f0] px-2.5 py-1 text-xs font-semibold text-[#004e56]">
                              <Hash className="h-3 w-3" />
                              On-chain
                            </span>
                          ) : (
                            <span className="text-xs text-[#6b6257]">Pending</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
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
