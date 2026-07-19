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
  groq: "bg-[#ffe7c2] text-[#6f3f00] border-[#e7c48c]",
  openai: "bg-[#d8f3f0] text-[#004e56] border-[#8fcac4]",
  gemini: "bg-[#dff0ff] text-[#16466f] border-[#a9cfe8]",
  openrouter: "bg-[#eadff7] text-[#54337a] border-[#cdb8e7]",
  browser: "bg-[#d8f3f0] text-[#004e56] border-[#8fcac4]",
  external_docker: "bg-[#ffe01b] text-[#241c15] border-[#241c15]",
};

const providerLabels: Record<string, string> = {
  groq: "Groq",
  openai: "OpenAI",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  browser: "Browser",
  external_docker: "Docker",
};

export function AgentCard({ agent, index = 0 }: AgentCardProps) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Link href={`/agents/${agent.id}`} className="block group">
        <div className="relative overflow-hidden rounded-[22px] border border-[#d9cfba] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#241c15] hover:shadow-[5px_5px_0_#241c15]">
          {/* Provider badge */}
          <div className="flex items-center justify-between mb-4">
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${providerColors[agent.provider] || "bg-[#f6f1e7] text-[#6b6257] border-[#d9cfba]"}`}>
              <Zap className="h-3 w-3" />
              {providerLabels[agent.provider]}
            </div>
            <TrustBadge score={agent.trust_score || 0} size="sm" showLabel={false} />
          </div>

          {/* Agent info */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[#241c15] mb-1 group-hover:text-[#007c89] transition-colors">
              {agent.name}
            </h3>
            <p className="text-sm text-[#6b6257] line-clamp-2">
              {agent.description || "No description provided"}
            </p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-[#6b6257]">
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
            <ArrowRight className="h-5 w-5 text-[#241c15]" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
