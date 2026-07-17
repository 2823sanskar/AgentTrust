"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Agent, Run } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { AgentCard } from "@/components/agents/agent-card";
import { motion } from "framer-motion";
import { User, Mail, Calendar, Bot, Activity, Wallet } from "lucide-react";
import Link from "next/link";
import { StellarWalletButton } from "@/components/wallet/stellar-wallet-button";

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [agentsRes, runsRes] = await Promise.all([
          api.getAgents({ page_size: 50 }),
          api.getRuns({ user_id: user.id, page_size: 20 }),
        ]);
        setAgents(agentsRes.agents.filter((a) => a.developer_id === user.id));
        setRuns(runsRes.runs);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#060612] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060612]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          {/* Profile header */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 mb-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{user.name}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {user.email}</span>
                  <span className="flex items-center gap-1"><User className="h-4 w-4" /> {user.role}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Joined {new Date(user.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              </div>
              <StellarWalletButton />
            </div>
          </div>

          {/* Stellar Wallet */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 mb-8">
            <div className="mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Stellar Wallet</h2>
            </div>
            <p className="mb-4 text-sm text-gray-400">
              Optional: connect Stellar wallet to attach identity to runs.
            </p>
            {user.stellar_wallet_address ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Public Key</p>
                  <code className="block break-all text-sm text-emerald-300">{user.stellar_wallet_address}</code>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Network</p>
                  <p className="text-sm text-white capitalize">{user.stellar_wallet_network || "testnet"}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Platform proofs still work without a wallet.
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
              <Bot className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{agents.length}</p>
              <p className="text-xs text-gray-500">Agents</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
              <Activity className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{runs.length}</p>
              <p className="text-xs text-gray-500">Executions</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
              <User className="h-6 w-6 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white capitalize">{user.role}</p>
              <p className="text-xs text-gray-500">Account Type</p>
            </div>
          </div>

          {/* My Agents */}
          {agents.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">My Agents</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent, i) => (
                  <AgentCard key={agent.id} agent={agent} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Recent Executions */}
          {runs.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Recent Executions</h2>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] divide-y divide-white/5">
                {runs.slice(0, 10).map((run) => (
                  <Link key={run.id} href={`/runs/${run.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
                    <div>
                      <p className="text-sm text-white">{run.agent_name || "Unknown Agent"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{new Date(run.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full ${
                      run.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {run.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
