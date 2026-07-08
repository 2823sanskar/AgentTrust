"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Agent } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AgentCard } from "@/components/agents/agent-card";
import { motion } from "framer-motion";
import { Search, Filter, Bot } from "lucide-react";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const loadAgents = async () => {
    setLoading(true);
    try {
      const res = await api.getAgents({ search: search || undefined, provider: provider || undefined, page, page_size: pageSize });
      setAgents(res.agents);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load agents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(loadAgents, 300);
    return () => clearTimeout(timeout);
  }, [search, provider, page]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-[#060612]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-white mb-2">Agent Directory</h1>
          <p className="text-gray-500 mb-8">Discover and execute verified AI agents</p>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              id="agent-search"
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all"
            />
          </div>
          <div className="flex gap-2">
            {["", "groq", "openai", "gemini"].map((p) => (
              <button
                key={p}
                onClick={() => { setProvider(p); setPage(1); }}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  provider === p
                    ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                    : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                }`}
              >
                {p === "" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-6 animate-pulse">
                <div className="flex justify-between mb-4">
                  <div className="h-6 w-16 bg-white/10 rounded-full" />
                  <div className="h-10 w-10 bg-white/10 rounded-full" />
                </div>
                <div className="h-5 w-3/4 bg-white/10 rounded mb-2" />
                <div className="h-4 w-full bg-white/5 rounded mb-1" />
                <div className="h-4 w-2/3 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20">
            <Bot className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No agents found</p>
            <p className="text-gray-600 text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} index={i} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                      page === i + 1
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
