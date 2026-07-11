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
    bg: "from-cyan-500/10 to-blue-500/10",
    border: "border-cyan-500/20",
    icon: "text-cyan-400",
    glow: "shadow-cyan-500/10",
  },
  emerald: {
    bg: "from-emerald-500/10 to-teal-500/10",
    border: "border-emerald-500/20",
    icon: "text-emerald-400",
    glow: "shadow-emerald-500/10",
  },
  purple: {
    bg: "from-purple-500/10 to-pink-500/10",
    border: "border-purple-500/20",
    icon: "text-purple-400",
    glow: "shadow-purple-500/10",
  },
  amber: {
    bg: "from-amber-500/10 to-orange-500/10",
    border: "border-amber-500/20",
    icon: "text-amber-400",
    glow: "shadow-amber-500/10",
  },
};

export function StatCard({ label, value, icon: Icon, trend, color = "cyan" }: StatCardProps) {
  const c = colorMap[color];

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden rounded-xl border ${c.border} bg-gradient-to-br ${c.bg} p-6 shadow-lg ${c.glow}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {trend && (
            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-white/5 ${c.icon}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {/* Decorative gradient */}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br from-white/5 to-transparent blur-xl" />
    </motion.div>
  );
}
