"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Agent } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AgentCard } from "@/components/agents/agent-card";
import { motion } from "framer-motion";
import { Search, Bot } from "lucide-react";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const loadAgents = useCallback(async () => {
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
  }, [page, provider, search]);

  useEffect(() => {
    const timeout = setTimeout(loadAgents, 300);
    return () => clearTimeout(timeout);
  }, [loadAgents]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-[#f6f1e7]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-[#241c15] mb-2">Agent Directory</h1>
          <p className="text-[#6b6257] mb-8">Discover and execute verified AI agents</p>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6257]" />
            <input
              id="agent-search"
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all"
            />
          </div>
          <div className="flex gap-2">
            {["", "openrouter", "browser"].map((p) => (
              <button
                key={p}
                onClick={() => { setProvider(p); setPage(1); }}
                className={`px-4 py-3 rounded-[20px] text-sm font-medium transition-all ${
                  provider === p
                    ? "bg-[#d8f3f0] border border-[#8fcac4] text-[#007c89]"
                    : "bg-white border border-[#d9cfba] text-[#6b6257] hover:text-[#241c15] hover:border-[#241c15]"
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
              <div key={i} className="rounded-[20px] border border-[#d9cfba] bg-white p-6 animate-pulse">
                <div className="flex justify-between mb-4">
                  <div className="h-6 w-16 bg-[#f6f1e7] rounded-full" />
                  <div className="h-10 w-10 bg-[#f6f1e7] rounded-full" />
                </div>
                <div className="h-5 w-3/4 bg-[#f6f1e7] rounded mb-2" />
                <div className="h-4 w-full bg-white rounded mb-1" />
                <div className="h-4 w-2/3 bg-white rounded" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20">
            <Bot className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <p className="text-[#6b6257] text-lg">No agents found</p>
            <p className="text-[#8a8175] text-sm mt-1">Try adjusting your search or filters</p>
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
                        ? "bg-[#d8f3f0] text-[#007c89] border border-[#8fcac4]"
                        : "bg-white text-[#6b6257] hover:text-[#241c15] hover:bg-[#f6f1e7]"
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
