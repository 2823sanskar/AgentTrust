"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import { Agent, Run } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { LiveSandboxConsole } from "@/components/execution/LiveSandboxConsole";
import { motion } from "framer-motion";
import {
  Send, Bot, Loader2, Monitor, AlertTriangle
} from "lucide-react";

function ExecuteContent() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent_id") || searchParams.get("id");

  const [agent, setAgent] = useState<Agent | null>(null);
  const [task, setTask] = useState("");
  const [result, setResult] = useState<Run | null>(null);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (agentId) {
      api.getAgent(agentId).then(setAgent).catch(console.error);
    }
  }, [agentId]);

  const handleExecute = async () => {
    if (!task.trim() || executing) return;
    setExecuting(true);
    setError("");
    setResult(null);
    setElapsed(0);

    const startTs = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTs) / 1000));
    }, 1000);

    try {
      const run = await api.execute({
        agent_id: agentId || undefined,
        task,
        is_interactive: true
      });
      setResult(run);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Execution failed"));
    } finally {
      setExecuting(false);
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    }
  };

  const handleInteractiveSessionComplete = async (updatedRun?: Run) => {
    setExecuting(false);
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }

    if (updatedRun) {
      setResult(updatedRun);
      return;
    }

    if (!result?.id) return;
    try {
      const refreshedRun = await api.getRun(result.id);
      setResult(refreshedRun);
    } catch (err) {
      console.error("Failed to refresh completed interactive run:", err);
    }
  };

  return (
    <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#007c89]/20 bg-[#d8f3f0] px-3 py-1 text-xs font-semibold text-[#004e56] mb-2">
              <Monitor className="h-3.5 w-3.5" /> Direct Remote Desktop Sandbox
            </div>
            <h1 className="text-3xl font-bold text-[#241c15]">Interactive Execution Console</h1>
            <p className="text-sm text-[#6b6257] mt-1">
              Dispatch tasks directly to the isolated remote desktop sandbox environment.
            </p>
          </div>
        </div>

        {/* Agent Badge (if selected) */}
        {agent && (
          <div className="rounded-[20px] border border-[#d9cfba] bg-white p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffe01b]/40 to-white border border-[#241c15]/10">
                <Bot className="h-5 w-5 text-[#007c89]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#241c15]">{agent.name}</h2>
                <p className="text-xs text-[#6b6257] font-mono">{agent.id}</p>
              </div>
            </div>
            <span className="rounded-full border border-[#8fcac4] bg-[#d8f3f0] px-3 py-1 text-xs font-medium text-[#004e56]">
              {agent.provider}
            </span>
          </div>
        )}

        {/* Task Form */}
        <div className="rounded-[24px] border border-[#d9cfba] bg-white p-6 shadow-sm mb-8">
          <label htmlFor="task-prompt" className="block text-sm font-semibold text-[#241c15] mb-2">
            Task Prompt
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="task-prompt"
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExecute()}
              placeholder="e.g. Open browser, navigate to news site, extract top headlines..."
              disabled={executing}
              className="flex-1 px-4 py-3 rounded-[16px] bg-[#fbf7ee] border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleExecute}
              disabled={executing || !task.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-[16px] border border-[#241c15] bg-[#ffe01b] font-semibold text-[#241c15] hover:bg-[#ebd019] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
            >
              {executing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Executing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Run Task
                </>
              )}
            </button>
          </div>
          {error && (
            <div className={`mt-4 rounded-xl border p-4 text-xs font-mono transition-all ${
              error.toLowerCase().includes("offline") || error.toLowerCase().includes("503") || error.toLowerCase().includes("boot")
                ? "border-amber-400/50 bg-amber-50 text-amber-900 shadow-sm"
                : "border-red-200 bg-red-50 text-red-700"
            }`}>
              <div className="font-bold flex items-center gap-2 text-sm mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                {error.toLowerCase().includes("offline") || error.toLowerCase().includes("503")
                  ? "Desktop Sandbox Offline"
                  : "Execution Failed"}
              </div>
              <p className="leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Live Console & Remote Desktop */}
        <div className="mb-8">
          <LiveSandboxConsole
            runId={result?.id}
            streamUrl={result?.stream_url}
            actionLog={result?.action_log}
            stdout={result?.stdout}
            stderr={result?.stderr}
            isActive={executing || result?.status === "running"}
            status={result?.status}
            agentProvider={agent?.provider || "remote_desktop"}
            routingMode={result?.routing_mode || "cloud_sandbox"}
            elapsedSeconds={elapsed}
            remoteDisplayUrl={result?.remote_display_url}
            isInteractive={true}
            desktopStatus={result?.desktop_status}
            onInteractiveSessionComplete={handleInteractiveSessionComplete}
          />
        </div>
      </motion.div>
    </main>
  );
}

export default function ExecutePage() {
  return (
    <div className="min-h-screen bg-[#f6f1e7]">
      <Navbar />
      <Suspense fallback={
        <div className="min-h-screen bg-[#f6f1e7] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#8fcac4] border-t-[#007c89] rounded-full animate-spin" />
        </div>
      }>
        <ExecuteContent />
      </Suspense>
      <Footer />
    </div>
  );
}
