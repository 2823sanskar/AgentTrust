"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Agent, Run } from "@/types";
import { Navbar } from "@/components/layout/navbar";
import { LiveSandboxConsole } from "@/components/execution/LiveSandboxConsole";
import { motion } from "framer-motion";
import {
  Send, Bot, Clock, CheckCircle2, XCircle, Hash,
  FileText, ArrowRight, Loader2, Shield, Globe, Container
} from "lucide-react";

export default function ExecuteAgentPage() {
  const params = useParams();
  const id = params.id as string;
  const { isAuthenticated } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [task, setTask] = useState("");
  const [result, setResult] = useState<Run | null>(null);
  const [loading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.getAgent(id).then(setAgent).catch(console.error);
  }, [id]);


  const handleExecute = async () => {
    if (!task.trim()) return;
    setExecuting(true);
    setError("");
    setResult(null);
    setElapsed(0);
    // Start elapsed timer
    const startTs = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTs) / 1000));
    }, 1000);
    try {
      const run = await api.execute({ agent_id: id, task, is_interactive: true });
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


  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f1e7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#8fcac4] border-t-[#007c89] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f1e7]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          {/* Agent mini card */}
          {agent && (
            <div className="rounded-[20px] border border-[#d9cfba] bg-white p-5 mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#ffe01b]/40 to-white">
                <Bot className="h-6 w-6 text-[#007c89]" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[#241c15]">{agent.name}</h2>
                <p className="text-sm text-[#6b6257]">{agent.provider} / {agent.model}</p>
              </div>
              <Link href={`/agents/${agent.id}`} className="text-sm text-[#007c89] hover:text-[#004e56]">
                View Details
              </Link>
            </div>
          )}

          <h1 className="text-2xl font-bold text-[#241c15] mb-6">Execute Agent</h1>

          {!isAuthenticated ? (
            <>
              <div className="rounded-[20px] border border-[#e5c917] bg-amber-500/5 p-8 text-center">
                <p className="text-[#8b5e00] mb-4">You need to sign in to execute agents</p>
                <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-[20px] bg-[#ffe01b] border border-[#241c15] text-[#241c15] font-medium">
                  Sign In <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-8">
                <LiveSandboxConsole
                  agentProvider={agent?.provider || "external_docker"}
                  routingMode="cloud_sandbox"
                />
              </div>
            </>
          ) : (
            <>
              {/* Task input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#403b33] mb-2">Your Task</label>
                <textarea
                  id="task-input"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  rows={6}
                  placeholder="Describe the task you want the agent to perform..."
                  className="w-full px-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all resize-none"
                />
              </div>

              <button
                id="execute-btn"
                onClick={handleExecute}
                disabled={executing || !task.trim()}
                className="flex items-center gap-2 px-8 py-3 rounded-[20px] bg-[#ffe01b] border border-[#241c15] text-[#241c15] font-semibold hover:bg-[#f6d90b] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-black/10"
              >
                {executing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Executing... {elapsed > 0 && <span className="opacity-70 text-sm font-normal ml-1">({elapsed}s)</span>}
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Execute
                  </>
                )}
              </button>

              {/* Browser agent hint */}
              {agent?.provider === "browser" && !executing && !result && (
                <p className="mt-3 text-xs text-[#6b6257] flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Browser agent runs may take up to 2 minutes - the agent browses the web in real time.
                </p>
              )}

              {agent?.provider === "external_docker" && !executing && !result && (
                <p className="mt-3 text-xs text-[#6b6257] flex items-center gap-1.5">
                  <Container className="h-3.5 w-3.5" />
                  Docker sandbox run: {agent.docker_image} with a {agent.timeout_seconds || 60}s timeout.
                </p>
              )}

              {/* Live progress hint during execution */}
              {executing && agent?.provider === "browser" && (
                <div className="mt-3 flex items-center gap-2 text-xs text-[#007c89]/70">
                  <Globe className="h-3.5 w-3.5 animate-pulse" />
                  <span>Browsing the web live - please keep this page open...</span>
                </div>
              )}

              {executing && agent?.provider === "external_docker" && (
                <div className="mt-3 flex items-center gap-2 text-xs text-[#007c89]/70">
                  <Container className="h-3.5 w-3.5 animate-pulse" />
                  <span>Running the external agent inside the local Docker sandbox...</span>
                </div>
              )}


              {/* Error */}
              {error && (
                <div className="mt-6 p-4 rounded-[20px] bg-[#fbe7e7] border border-[#efb4b4] text-[#a12a2a] text-sm">
                  {error}
                </div>
              )}

              <div className="mt-8">
                <LiveSandboxConsole
                  runId={result?.id}
                  actionLog={result?.action_log}
                  stdout={result?.container_stdout}
                  stderr={result?.container_stderr}
                  isActive={executing || result?.status === "pending" || result?.desktop_status === "running"}
                  status={result?.status}
                  agentProvider={agent?.provider}
                  routingMode={result?.routing_mode || "cloud_sandbox"}
                  elapsedSeconds={elapsed}
                  isInteractive={result?.is_interactive}
                  onInteractiveSessionComplete={handleInteractiveSessionComplete}
                />
              </div>

              {/* Result */}
              {result && (
                <motion.div
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 space-y-4"
                >
                  {/* Execution metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-[20px] border border-[#d9cfba] bg-white p-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                        result.status === "success" ? "text-[#007c89]" : "text-[#a12a2a]"
                      }`}>
                        {result.status === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {result.status}
                      </span>
                    </div>
                    <div className="rounded-[20px] border border-[#d9cfba] bg-white p-4 text-center">
                      <span className="text-sm text-[#6b6257] flex items-center justify-center gap-1">
                        <Clock className="h-4 w-4" /> {result.execution_time?.toFixed(2)}s
                      </span>
                    </div>
                    <div className="rounded-[20px] border border-[#d9cfba] bg-white p-4 text-center">
                      <span className="text-sm text-[#6b6257] flex items-center justify-center gap-1 font-mono">
                        <Hash className="h-4 w-4" /> {result.hash?.slice(0, 12)}...
                      </span>
                    </div>
                    <div className="rounded-[20px] border border-[#d9cfba] bg-white p-4 text-center">
                      {result.stellar_transaction ? (
                        <span className="text-sm text-[#007c89] flex items-center justify-center gap-1">
                          <Shield className="h-4 w-4" /> On-chain
                        </span>
                      ) : (
                        <span className="text-sm text-[#8a8175]">Pending anchor</span>
                      )}
                    </div>
                  </div>

                  {/* Action Log */}
                  {result.action_log && result.action_log.length > 0 && (
                    <div className="rounded-[20px] border border-[#d9cfba] bg-white overflow-hidden">
                      <div className="px-5 py-3 border-b border-[#e7ddc6] flex items-center gap-2">
                        <Bot className="h-4 w-4 text-[#007c89]" />
                        <span className="text-sm font-medium text-[#403b33]">Recorded Actions</span>
                      </div>
                      <div className="p-5 space-y-3">
                        {result.action_log.map((item, index) => (
                          <div key={`${item.step}-${item.action}-${index}`} className="flex gap-3 rounded-lg bg-white p-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8f3f0] text-xs text-[#007c89]">
                              {item.step}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-[#241c15]">{item.action}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                                  item.status === "success"
                                    ? "bg-[#d8f3f0] text-[#007c89]"
                                    : item.status === "failure"
                                      ? "bg-[#fbe7e7] text-[#a12a2a]"
                                      : "bg-[#fff4c4] text-[#8b5e00]"
                                }`}>
                                  {item.status}
                                </span>
                              </div>
                              <p className="truncate text-xs text-[#6b6257]">{item.target}</p>
                              <p className="text-xs text-[#6b6257]">{item.note}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Response */}
                  <div className="rounded-[20px] border border-[#d9cfba] bg-white overflow-hidden">
                    <div className="px-5 py-3 border-b border-[#e7ddc6] flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#007c89]" />
                      <span className="text-sm font-medium text-[#403b33]">Agent Response</span>
                    </div>
                    <div className="p-5">
                      <pre className="whitespace-pre-wrap text-sm text-[#403b33] leading-relaxed font-sans">
                        {result.response}
                      </pre>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="flex gap-3">
                    <Link
                      href={`/runs/${result.id}`}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-[20px] border border-[#d9cfba] text-sm text-[#6b6257] hover:text-[#241c15] hover:border-[#241c15] transition-all"
                    >
                      View Full Details <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/verify/${result.id}`}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-[20px] border border-[#8fcac4] text-sm text-[#007c89] hover:bg-[#d8f3f0] transition-all"
                    >
                      <Shield className="h-4 w-4" /> Verify Execution
                    </Link>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
