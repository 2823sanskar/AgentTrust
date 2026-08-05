"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { motion } from "framer-motion";
import {
  Bot,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Package,
  Terminal,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";

const CATEGORIES = ["Web Automation", "Coding", "DeFi", "General"];

export default function RegisterAgentPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [category, setCategory] = useState("Web Automation");
  const [description, setDescription] = useState("");
  const [installCmd, setInstallCmd] = useState("");
  const [execCmd, setExecCmd] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredHash, setRegisteredHash] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const canRegister = isAuthenticated && user?.role === "developer";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsMounted(true);
      if (user?.id) {
        setAuthorId(user.stellar_wallet_address || user.id);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!canRegister) {
      setError(
        !isAuthenticated
          ? "Please sign in with a developer account to register an agent."
          : "Access denied: developer role required."
      );
      return;
    }

    setLoading(true);
    try {
      const agent = await api.createAgent({
        name,
        description: description || undefined,
        author_id: authorId || user?.id,
        category,
        install_cmd: installCmd || undefined,
        exec_cmd: execCmd || undefined,
        provider: "external_docker",
        model: "desktop-environment",
        system_prompt: "Interactive AI Agent registered via AgentTrust public registry.",
        agent_type: "custom_docker",
        docker_image: "agenttrust/desktop-environment:latest",
        is_public: true,
      });

      if (agent.registration_hash) {
        setRegisteredHash(agent.registration_hash);
      }

      setTimeout(() => {
        router.push("/agents");
      }, 2500);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to register agent"));
    } finally {
      setLoading(false);
    }
  };

  const copyHash = () => {
    if (!registeredHash) return;
    navigator.clipboard.writeText(registeredHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#f6f1e7]">
        <Navbar />
        <div className="pt-32 flex justify-center px-4">
          <div className="w-8 h-8 border-2 border-[#8fcac4] border-t-[#007c89] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f1e7] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#007c89]/20 bg-[#d8f3f0] px-3 py-1 text-xs font-semibold text-[#004e56] mb-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Registry Submission
          </div>
          <h1 className="text-3xl font-bold text-[#241c15] mb-2">Register AI Agent</h1>
          <p className="text-[#6b6257] mb-8">
            Submit your agent definition to generate an immutable SHA-256 registration fingerprint.
          </p>

          {registeredHash ? (
            <div className="rounded-[24px] border border-emerald-300 bg-emerald-50 p-6 text-center space-y-4 shadow-sm">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
              <h2 className="text-xl font-bold text-emerald-950">Agent Registered Successfully!</h2>
              <p className="text-xs text-emerald-800">
                Generated SHA-256 Code Fingerprint:
              </p>
              <div className="rounded-[16px] bg-white border border-emerald-200 p-3 font-mono text-xs text-emerald-900 flex items-center justify-between gap-2">
                <span className="truncate">{registeredHash}</span>
                <button
                  onClick={copyHash}
                  className="shrink-0 text-xs font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
                >
                  {copiedHash ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-emerald-700">Redirecting to Agent Directory...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {authLoading && (
                <div className="p-4 rounded-[20px] bg-[#d8f3f0] border border-[#8fcac4] text-sm text-[#004e56]">
                  Checking authentication status...
                </div>
              )}

              {!authLoading && !isAuthenticated && (
                <div className="p-4 rounded-[20px] bg-[#fff4c4] border border-[#e5c917] text-sm text-[#8b5e00]">
                  Please sign in with a developer account to register an agent.
                </div>
              )}

              {!authLoading && isAuthenticated && user?.role !== "developer" && (
                <div className="p-4 rounded-[20px] bg-[#fff4c4] border border-[#e5c917] text-sm text-[#8b5e00]">
                  Access denied: developer role required.
                </div>
              )}

              {error && (
                <div className="p-4 rounded-[20px] bg-[#fbe7e7] border border-[#efb4b4] text-sm text-[#a12a2a] flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Form Card */}
              <div className="rounded-[24px] border border-[#d9cfba] bg-white p-6 space-y-5 shadow-sm">
                <h2 className="text-lg font-semibold text-[#241c15] flex items-center gap-2">
                  <Bot className="h-5 w-5 text-[#007c89]" /> Agent Metadata
                </h2>

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-[#403b33] mb-1.5 uppercase tracking-wider">
                    Agent Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    placeholder="e.g. OpenClaw AI"
                    className="w-full px-4 py-3 rounded-[16px] bg-[#fbf7ee] border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 text-sm transition-all"
                  />
                </div>

                {/* Author ID / Wallet */}
                <div>
                  <label className="block text-xs font-bold text-[#403b33] mb-1.5 uppercase tracking-wider">
                    Author ID / Wallet Address *
                  </label>
                  <input
                    type="text"
                    value={authorId}
                    onChange={(e) => setAuthorId(e.target.value)}
                    required
                    placeholder="e.g. 0x123...456 or developer_1"
                    className="w-full px-4 py-3 rounded-[16px] bg-[#fbf7ee] border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 text-sm font-mono transition-all"
                  />
                </div>

                {/* Category Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-[#403b33] mb-1.5 uppercase tracking-wider">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-[16px] bg-[#fbf7ee] border border-[#d9cfba] text-[#241c15] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 text-sm transition-all"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-[#403b33] mb-1.5 uppercase tracking-wider">
                    Capabilities Overview (Description)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe what your agent does and its primary capabilities..."
                    className="w-full px-4 py-3 rounded-[16px] bg-[#fbf7ee] border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 text-sm transition-all resize-none"
                  />
                </div>

                {/* Install Command */}
                <div>
                  <label className="block text-xs font-bold text-[#403b33] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-[#007c89]" /> Install Command
                  </label>
                  <input
                    type="text"
                    value={installCmd}
                    onChange={(e) => setInstallCmd(e.target.value)}
                    placeholder="e.g. pip install openclaw"
                    className="w-full px-4 py-3 rounded-[16px] bg-[#fbf7ee] border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 text-sm font-mono transition-all"
                  />
                </div>

                {/* Execution Command Template */}
                <div>
                  <label className="block text-xs font-bold text-[#403b33] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-[#007c89]" /> Execution Command Template
                  </label>
                  <input
                    type="text"
                    value={execCmd}
                    onChange={(e) => setExecCmd(e.target.value)}
                    placeholder='e.g. openclaw --task "{task}"'
                    className="w-full px-4 py-3 rounded-[16px] bg-[#fbf7ee] border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 text-sm font-mono transition-all"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || authLoading || !canRegister || !name.trim()}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-[18px] bg-[#ffe01b] border border-[#241c15] text-[#241c15] font-semibold text-base hover:bg-[#ebd019] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#241c15]/30 border-t-[#241c15] rounded-full animate-spin" />
                ) : (
                  <>
                    Register & Generate Fingerprint
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
