"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color?: "cyan" | "emerald" | "purple" | "amber";
}

const colorMap = {
  cyan: {
    bg: "from-[#d8f3f0] to-white",
    border: "border-[#b7ddd8]",
    icon: "text-[#007c89]",
    glow: "shadow-black/5",
  },
  emerald: {
    bg: "from-[#e4f6d7] to-white",
    border: "border-[#bfdca6]",
    icon: "text-[#2f6f32]",
    glow: "shadow-black/5",
  },
  purple: {
    bg: "from-[#fbeeca] to-white",
    border: "border-[#e6d5a7]",
    icon: "text-[#8b5e00]",
    glow: "shadow-black/5",
  },
  amber: {
    bg: "from-[#ffe01b]/40 to-white",
    border: "border-[#e5c917]",
    icon: "text-[#241c15]",
    glow: "shadow-black/5",
  },
};

export function StatCard({ label, value, icon: Icon, trend, color = "cyan" }: StatCardProps) {
  const c = colorMap[color];

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden rounded-[22px] border ${c.border} bg-gradient-to-br ${c.bg} p-6 shadow-sm ${c.glow}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#6b6257] mb-1">{label}</p>
          <p className="text-3xl font-semibold text-[#241c15]">{value}</p>
          {trend && (
            <p className="text-xs text-[#007c89] mt-2 flex items-center gap-1">
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-2xl bg-white/80 border border-black/10 ${c.icon}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </motion.div>
  );
}
