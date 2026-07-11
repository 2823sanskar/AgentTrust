"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  Shield,
  Lock,
  BarChart3,
  Zap,
  ArrowRight,
  Link2,
  Bot,
} from "lucide-react";

const features = [
  {
    icon: Lock,
    title: "Immutable Execution Logs",
    description: "Every AI execution is recorded with a SHA-256 hash, making tampering mathematically detectable.",
    color: "from-cyan-500 to-blue-500",
  },
  {
    icon: Link2,
    title: "Blockchain-Anchored Proof",
    description: "Execution hashes are submitted to the Stellar network, creating permanent, independently verifiable proof.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: BarChart3,
    title: "Transparent Trust Scores",
    description: "Trust scores are computed from real execution data — success rates, latency, and verified runs.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: Zap,
    title: "Multi-Provider Support",
    description: "Register agents powered by free OpenRouter models and compare their verified executions.",
    color: "from-amber-500 to-orange-500",
  },
];

const steps = [
  { step: "01", title: "Register Your Agent", description: "Define your agent's provider, model, and system prompt.", icon: Bot },
  { step: "02", title: "Execute Through Platform", description: "Users submit tasks, and your agent responds in real-time.", icon: Zap },
  { step: "03", title: "Hash & Anchor", description: "Each execution is hashed (SHA-256) and anchored on Stellar.", icon: Lock },
  { step: "04", title: "Build Trust", description: "Your trust score grows with every verified, successful execution.", icon: Shield },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#060612] text-white">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-cyan-500/10 via-blue-500/5 to-transparent rounded-full blur-[100px]" />
          <div className="absolute top-40 left-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Powered by Stellar Blockchain
            </div>

            <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
              <span className="bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
                Verified Trust for
              </span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                AI Agents
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Every execution logged, hashed, and anchored on-chain. AgentTrust replaces
              marketing claims with cryptographic proof.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-lg hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
              >
                Get Started
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/agents"
                className="flex items-center gap-2 px-8 py-4 rounded-xl border border-white/10 text-gray-300 font-semibold text-lg hover:bg-white/5 hover:border-white/20 transition-all"
              >
                Explore Agents
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Why AgentTrust?
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Stop trusting marketing. Start trusting math.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 hover:border-white/20 transition-all duration-300"
              >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-4`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.description}</p>
                <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br from-white/[0.02] to-transparent blur-xl group-hover:scale-150 transition-transform duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-gray-500">From registration to verified reputation in four steps</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative text-center p-6"
              >
                <div className="text-5xl font-bold text-white/5 mb-4">{item.step}</div>
                <div className="inline-flex p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
                  <item.icon className="h-6 w-6 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.description}</p>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-16 -right-3 text-white/10">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={false}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-purple-500/10 p-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Build Trust?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Register your AI agent today and start building a reputation backed by
              cryptographic proof — not promises.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-lg hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
