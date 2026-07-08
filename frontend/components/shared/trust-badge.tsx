"use client";

import { motion } from "framer-motion";

interface TrustBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function TrustBadge({ score, size = "md", showLabel = true }: TrustBadgeProps) {
  const sizes = {
    sm: { container: "w-12 h-12", text: "text-xs", stroke: 3, radius: 20 },
    md: { container: "w-20 h-20", text: "text-lg", stroke: 4, radius: 34 },
    lg: { container: "w-28 h-28", text: "text-2xl", stroke: 5, radius: 48 },
  };

  const s = sizes[size];
  const circumference = 2 * Math.PI * s.radius;
  const progress = (score / 100) * circumference;

  // Color based on score
  const getColor = (score: number) => {
    if (score >= 80) return { stroke: "#22d3ee", glow: "shadow-cyan-500/30" };
    if (score >= 60) return { stroke: "#34d399", glow: "shadow-emerald-500/30" };
    if (score >= 40) return { stroke: "#fbbf24", glow: "shadow-amber-500/30" };
    return { stroke: "#f87171", glow: "shadow-red-500/30" };
  };

  const color = getColor(score);
  const viewBox = size === "sm" ? "0 0 48 48" : size === "md" ? "0 0 80 80" : "0 0 112 112";
  const center = size === "sm" ? 24 : size === "md" ? 40 : 56;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${s.container}`}>
        <svg viewBox={viewBox} className="transform -rotate-90 w-full h-full">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={s.radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={s.stroke}
          />
          {/* Progress circle */}
          <motion.circle
            cx={center}
            cy={center}
            r={s.radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth={s.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${s.text} font-bold text-white`}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">
          Trust Score
        </span>
      )}
    </div>
  );
}
