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
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: Lock,
    title: "Execution evidence",
    description: "Capture stdout, stderr, timing, exit code, final output, and action logs for every agent run.",
  },
  {
    icon: Link2,
    title: "Stellar proof",
    description: "Anchor execution hashes on the Stellar Network so every trust claim can be independently checked.",
  },
  {
    icon: BarChart3,
    title: "Trust scoring",
    description: "Turn verified execution history into a clear score operators can scan quickly.",
  },
  {
    icon: Zap,
    title: "Docker sandbox",
    description: "Run external Docker agents through a local or cloud worker without changing the core app flow.",
  },
];

const steps = [
  { step: "01", title: "Register", description: "Add agent metadata, image, command, and timeout.", icon: Bot },
  { step: "02", title: "Execute", description: "Submit a task and route it through the sandbox worker.", icon: Zap },
  { step: "03", title: "Record", description: "Persist telemetry and hash the normalized evidence.", icon: Lock },
  { step: "04", title: "Verify", description: "Open the run proof and Stellar transaction.", icon: Shield },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f6f1e7] text-[#241c15]">
      <Navbar />

      <section className="px-4 pb-16 pt-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_480px]">
          <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#241c15] bg-[#ffe01b] px-4 py-2 text-sm font-semibold">
              <Shield className="h-4 w-4" />
              Stellar blockchain verification layer
            </div>

            <h1 className="mb-6 max-w-3xl text-5xl font-semibold leading-[1.02] text-[#241c15] md:text-7xl">
              Verify AI agents before you trust them.
            </h1>

            <p className="mb-8 max-w-2xl text-lg leading-relaxed text-[#403b33] md:text-xl">
              AgentTrust records Docker agent executions, scores trust, hashes evidence, and anchors proof on Stellar.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#241c15] bg-[#241c15] px-7 py-3 text-base font-semibold text-white shadow-[0_4px_0_#d5c7aa] transition-transform hover:-translate-y-0.5"
              >
                Get Started
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/agents"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#241c15] bg-white px-7 py-3 text-base font-semibold text-[#241c15] transition-colors hover:bg-[#ffe01b]"
              >
                Explore agents
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-[#241c15] bg-white p-5 shadow-[10px_10px_0_#241c15]"
          >
            <div className="mb-5 flex items-center justify-between border-b border-[#e7ddc6] pb-4">
              <div>
                <p className="text-sm font-semibold">Latest sandbox run</p>
                <p className="text-xs text-[#6b6257]">external_docker / aws_staging</p>
              </div>
              <span className="rounded-full border border-[#007c89] bg-[#d8f3f0] px-3 py-1 text-xs font-semibold text-[#004e56]">
                Verified
              </span>
            </div>
            <div className="space-y-3">
              {[
                ["route", "cloud_sandbox"],
                ["exit_code", "0"],
                ["hash", "sha256:8a7f...c31b"],
                ["stellar", "mainnet anchored"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-[24px] bg-[#f6f1e7] px-4 py-3">
                  <span className="font-mono text-xs text-[#6b6257]">{label}</span>
                  <span className="font-mono text-sm text-[#241c15]">{value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-4xl font-semibold text-[#241c15]">Proof workflow</h2>
              <p className="mt-2 max-w-xl text-[#6b6257]">A clean verification loop for developer teams and agent operators.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#241c15] bg-[#ffe01b] px-4 py-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              MVP ready
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-[22px] border border-[#d9cfba] bg-white p-6 shadow-sm">
                <div className="mb-5 inline-flex rounded-[24px] bg-[#ffe01b] p-3 text-[#241c15]">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-[#241c15]">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-[#6b6257]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#dfd5bd] bg-[#fbf7ee] px-4 py-16">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-4">
          {steps.map((item) => (
            <div key={item.step} className="rounded-[22px] bg-[#f6f1e7] p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-4xl font-semibold text-[#d9cfba]">{item.step}</span>
                <item.icon className="h-6 w-6 text-[#007c89]" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#241c15]">{item.title}</h3>
              <p className="text-sm text-[#6b6257]">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-[#241c15] bg-[#ffe01b] p-10 text-center shadow-[8px_8px_0_#241c15]">
          <h2 className="mb-4 text-4xl font-semibold text-[#241c15]">Start verifying agent behavior.</h2>
          <p className="mx-auto mb-8 max-w-2xl text-[#403b33]">
            Register an agent, run a sandbox task, and open the proof page with the execution hash and Stellar transaction.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full border border-[#241c15] bg-[#241c15] px-8 py-3 font-semibold text-white"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
