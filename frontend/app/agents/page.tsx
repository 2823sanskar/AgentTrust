"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api, getErrorMessage } from "@/lib/api";
import { Agent } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Play,
  Copy,
  Check,
  Package,
  Terminal,
  ShieldCheck,
  Tag,
  UserCheck,
} from "lucide-react";

const CATEGORIES = ["All", "Web Automation", "Coding", "DeFi", "General"];

export default function AgentRegistryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getAgents({ page_size: 50 });
      setAgents(res.agents || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load agents directory"));
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesCategory =
        selectedCategory === "All" ||
        (agent.category || "General").toLowerCase() === selectedCategory.toLowerCase();

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        agent.name.toLowerCase().includes(query) ||
        (agent.description || "").toLowerCase().includes(query) ||
        (agent.author_id || "").toLowerCase().includes(query) ||
        (agent.registration_hash || "").toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [agents, searchQuery, selectedCategory]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f6f1e7] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#007c89]/20 bg-[#d8f3f0] px-3 py-1 text-xs font-semibold text-[#004e56] mb-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified Public Agent Registry
            </div>
            <h1 className="text-3xl font-bold text-[#241c15]">AI Agent Directory</h1>
            <p className="text-sm text-[#6b6257] mt-1">
              Explore SHA-256 fingerprinted AI agents and execute them in isolated cloud sandboxes.
            </p>
          </div>

          <Link
            href="/agents/register"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[16px] border border-[#241c15] bg-[#ffe01b] font-semibold text-[#241c15] hover:bg-[#ebd019] transition-transform hover:-translate-y-0.5 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Register New Agent
          </Link>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="rounded-[24px] border border-[#d9cfba] bg-white p-4 shadow-sm mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-[#b7aa8d]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents by name, description, author, or SHA-256 hash..."
              className="w-full pl-11 pr-4 py-3 rounded-[16px] bg-[#fbf7ee] border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 text-sm transition-all"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-1">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    active
                      ? "bg-[#007c89] text-white border border-[#007c89]"
                      : "bg-[#fbf7ee] text-[#6b6257] border border-[#d9cfba] hover:border-[#007c89]"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#8fcac4] border-t-[#007c89] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-sm text-red-700 text-center">
            {error}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#d9cfba] bg-white/60 p-12 text-center">
            <Package className="h-10 w-10 text-[#b7aa8d] mx-auto mb-3" />
            <h3 className="text-base font-semibold text-[#241c15]">No Agents Found</h3>
            <p className="text-xs text-[#6b6257] mt-1 max-w-md mx-auto">
              No registered agents matched your search or category filter. Try clearing your filters or register a custom agent.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#007c89] underline hover:text-[#004e56]"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => {
              const hash = agent.registration_hash || "a3f892c...e291";
              const truncatedHash = hash.length > 16 ? `${hash.slice(0, 8)}...${hash.slice(-8)}` : hash;
              const isCopied = copiedHashId === agent.id;

              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[24px] border border-[#d9cfba] bg-white p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Title & Badges */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="text-lg font-bold text-[#241c15] leading-tight">
                        {agent.name}
                      </h3>
                      <span className="shrink-0 rounded-full border border-[#8fcac4] bg-[#d8f3f0] px-2.5 py-0.5 text-[11px] font-semibold text-[#004e56] flex items-center gap-1">
                        <Tag className="h-3 w-3" /> {agent.category || "General"}
                      </span>
                    </div>

                    {/* Author ID */}
                    <div className="flex items-center gap-1.5 text-xs text-[#6b6257] font-mono mb-3">
                      <UserCheck className="h-3.5 w-3.5 text-[#007c89]" />
                      <span>{agent.author_id || agent.developer_name || "Developer"}</span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-[#403b33] mb-4 line-clamp-2 leading-relaxed">
                      {agent.description || "No description provided."}
                    </p>

                    {/* Code Command Boxes */}
                    <div className="space-y-2 mb-4 font-mono text-[11px]">
                      {agent.install_cmd && (
                        <div className="rounded-[12px] bg-[#fbf7ee] border border-[#d9cfba] p-2.5 text-[#004e56] flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 shrink-0 text-[#007c89]" />
                          <span className="truncate">{agent.install_cmd}</span>
                        </div>
                      )}
                      {agent.exec_cmd && (
                        <div className="rounded-[12px] bg-[#fbf7ee] border border-[#d9cfba] p-2.5 text-[#241c15] flex items-center gap-2">
                          <Terminal className="h-3.5 w-3.5 shrink-0 text-[#007c89]" />
                          <span className="truncate">{agent.exec_cmd}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {/* SHA-256 Fingerprint Badge */}
                    <div className="rounded-[14px] bg-[#f4f0e6] border border-[#d9cfba] px-3 py-2 flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#007c89] shrink-0" />
                        <span className="text-[10px] font-mono text-[#6b6257] truncate" title={hash}>
                          {truncatedHash}
                        </span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(hash, agent.id)}
                        className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-[#007c89] hover:text-[#004e56]"
                        title="Copy SHA-256 Registration Hash"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>

                    {/* Test Agent Action Button */}
                    <Link
                      href={`/execute?agent_id=${agent.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[14px] border border-[#241c15] bg-[#ffe01b] font-semibold text-xs text-[#241c15] hover:bg-[#ebd019] transition-transform hover:-translate-y-0.5 shadow-sm"
                    >
                      <Play className="h-3.5 w-3.5 fill-[#241c15]" /> Test Agent
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
