"use client";

import Link from "next/link";
import { Agent } from "@/types";
import { TrustBadge } from "@/components/shared/trust-badge";
import { Bot, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface AgentCardProps {
  agent: Agent;
  index?: number;
}

const providerColors: Record<string, string> = {
  groq: "from-orange-500 to-red-500",
  openai: "from-emerald-500 to-teal-500",
  gemini: "from-blue-500 to-purple-500",
  openrouter: "from-violet-500 to-fuchsia-500",
  browser: "from-cyan-500 to-sky-500",
};

const providerLabels: Record<string, string> = {
  groq: "Groq",
  openai: "OpenAI",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  browser: "Browser",
};

export function AgentCard({ agent, index = 0 }: AgentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Link href={`/agents/${agent.id}`} className="block group">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-cyan-500/30 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-cyan-500/5">
          {/* Provider badge */}
          <div className="flex items-center justify-between mb-4">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${providerColors[agent.provider]} text-white`}>
              <Zap className="h-3 w-3" />
              {providerLabels[agent.provider]}
            </div>
            <TrustBadge score={agent.trust_score || 0} size="sm" showLabel={false} />
          </div>

          {/* Agent info */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-cyan-400 transition-colors">
              {agent.name}
            </h3>
            <p className="text-sm text-gray-500 line-clamp-2">
              {agent.description || "No description provided"}
            </p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Bot className="h-3.5 w-3.5" />
              <span>{agent.model}</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{agent.total_runs || 0} runs</span>
            </div>
          </div>

          {/* Hover arrow */}
          <div className="absolute bottom-6 right-6 opacity-0 transform translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <ArrowRight className="h-5 w-5 text-cyan-400" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
