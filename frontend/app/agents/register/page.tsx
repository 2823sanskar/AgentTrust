"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import { Navbar } from "@/components/layout/navbar";
import { motion } from "framer-motion";
import { Bot, Zap, ArrowRight, AlertCircle, Package, Terminal, Plus, Trash2 } from "lucide-react";

const providers = [
  { value: "openrouter", label: "OpenRouter (Free)", models: ["openrouter/free"] },
  { value: "browser", label: "Browser Agent", models: ["browser-demo"] },
  { value: "external_docker", label: "External Docker", models: ["docker-contract-v1"] },
];

const emptyDockerCommands = new Set([
  "",
  "leave",
  "leave empty",
  "blank",
  "empty",
  "none",
  "null",
  "n/a",
  "default",
  "image cmd",
  "use image cmd",
  "leave blank",
  "leave blank to use the image cmd",
]);

function normalizeDockerCommand(value: string) {
  const command = value.trim();
  return emptyDockerCommands.has(command.toLowerCase()) ? undefined : command;
}

export default function RegisterAgentPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [registrationMode, setRegistrationMode] = useState<"prebuilt" | "custom">("prebuilt");
  const [executionType, setExecutionType] = useState<"custom_docker" | "custom_script">("custom_docker");
  const [provider, setProvider] = useState("openrouter");
  const [model, setModel] = useState("openrouter/free");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [dockerImage, setDockerImage] = useState("clawbot-demo:latest");
  const [dockerCommand, setDockerCommand] = useState("");
  const [sourceRepoUrl, setSourceRepoUrl] = useState("");
  const [envVarDraft, setEnvVarDraft] = useState("");
  const [requiredEnvVars, setRequiredEnvVars] = useState<string[]>([]);
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedProvider = providers.find((p) => p.value === provider);
  const canRegister = isAuthenticated && user?.role === "developer";

  const addEnvVar = () => {
    const key = envVarDraft.trim().toUpperCase();
    if (!key || requiredEnvVars.includes(key)) {
      setEnvVarDraft("");
      return;
    }
    setRequiredEnvVars((values) => [...values, key]);
    setEnvVarDraft("");
  };

  const removeEnvVar = (key: string) => {
    setRequiredEnvVars((values) => values.filter((value) => value !== key));
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
      const isExternal = registrationMode === "custom";
      const normalizedEntrypoint = normalizeDockerCommand(dockerCommand);
      const agent = await api.createAgent({
        name,
        description: description || undefined,
        provider: isExternal ? "external_docker" : provider as "openrouter" | "browser" | "external_docker",
        model: isExternal
          ? executionType === "custom_script" ? "custom-script-v1" : "docker-contract-v1"
          : model,
        system_prompt:
          isExternal
            ? systemPrompt || "External Docker agent using AgentTrust structured execution contract."
            : systemPrompt,
        agent_type: isExternal ? executionType : "prebuilt",
        docker_image: isExternal ? dockerImage : undefined,
        docker_command: isExternal ? normalizedEntrypoint : undefined,
        entrypoint_command: isExternal ? normalizedEntrypoint : undefined,
        required_env_vars: isExternal && requiredEnvVars.length ? requiredEnvVars : undefined,
        source_repo_url: isExternal && sourceRepoUrl ? sourceRepoUrl : undefined,
        timeout_seconds: isExternal ? timeoutSeconds : undefined,
        category: category || undefined,
      });
      sessionStorage.setItem("agenttrust:agent-created", agent.name);
      router.push("/agents?registered=1");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to register agent"));
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-[#f6f1e7]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-[#241c15] mb-2">Register AI Agent</h1>
          <p className="text-[#6b6257] mb-8">Configure your agent and start building trust</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {authLoading && (
              <div className="p-4 rounded-[20px] bg-[#d8f3f0] border border-[#8fcac4] text-sm text-[#004e56]">
                Checking authentication state...
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

            <div className="rounded-[24px] border border-[#d9cfba] bg-white p-6 space-y-5">
              <h2 className="text-lg font-semibold text-[#241c15] flex items-center gap-2">
                <Bot className="h-5 w-5 text-[#007c89]" /> Agent Info
              </h2>

              <div>
                <label className="block text-sm font-medium text-[#403b33] mb-2">Agent Name *</label>
                <input
                  id="agent-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  className="w-full px-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all"
                  placeholder="e.g., CodeReviewer Pro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#403b33] mb-2">Description</label>
                <textarea
                  id="agent-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all resize-none"
                  placeholder="What does your agent do?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#403b33] mb-2">Category</label>
                <input
                  id="agent-category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all"
                  placeholder="e.g., coding, research, support"
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-[#d9cfba] bg-white p-6 space-y-5">
              <h2 className="text-lg font-semibold text-[#241c15] flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#007c89]" /> AI Configuration
              </h2>

              <div>
                <label className="block text-sm font-medium text-[#403b33] mb-2">Registration Type *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRegistrationMode("prebuilt");
                      setProvider("openrouter");
                      setModel("openrouter/free");
                    }}
                    className={`p-3 rounded-[20px] border text-sm font-medium transition-all ${
                      registrationMode === "prebuilt"
                        ? "border-[#007c89] bg-[#d8f3f0] text-[#007c89]"
                        : "border-[#d9cfba] bg-white text-[#6b6257] hover:border-[#241c15]"
                    }`}
                  >
                    Pre-built Agent Template
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegistrationMode("custom");
                      setProvider("external_docker");
                      setModel("docker-contract-v1");
                      if (!systemPrompt) {
                        setSystemPrompt("External Docker agent using AgentTrust structured execution contract.");
                      }
                    }}
                    className={`p-3 rounded-[20px] border text-sm font-medium transition-all ${
                      registrationMode === "custom"
                        ? "border-[#007c89] bg-[#d8f3f0] text-[#007c89]"
                        : "border-[#d9cfba] bg-white text-[#6b6257] hover:border-[#241c15]"
                    }`}
                  >
                    Deploy External Custom Agent
                  </button>
                </div>
              </div>

              {registrationMode === "prebuilt" && (
                <div>
                  <label className="block text-sm font-medium text-[#403b33] mb-2">Template Provider *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {providers.filter((p) => p.value !== "external_docker").map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => {
                          setProvider(p.value);
                          setModel(p.models[0]);
                        }}
                        className={`p-3 rounded-[20px] border text-sm font-medium transition-all ${
                          provider === p.value
                            ? "border-[#007c89] bg-[#d8f3f0] text-[#007c89]"
                            : "border-[#d9cfba] bg-white text-[#6b6257] hover:border-[#241c15]"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {registrationMode === "custom" && (
                <div className="rounded-[20px] border border-[#8fcac4] bg-[#d8f3f0] p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#403b33] mb-2">Execution Type *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setExecutionType("custom_docker");
                          setModel("docker-contract-v1");
                        }}
                        className={`flex items-center justify-center gap-2 p-3 rounded-[20px] border text-sm font-medium transition-all ${
                          executionType === "custom_docker"
                            ? "border-[#007c89] bg-white text-[#007c89]"
                            : "border-[#d9cfba] bg-white/70 text-[#6b6257] hover:border-[#241c15]"
                        }`}
                      >
                        <Package className="h-4 w-4" /> Docker Container
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExecutionType("custom_script");
                          setModel("custom-script-v1");
                        }}
                        className={`flex items-center justify-center gap-2 p-3 rounded-[20px] border text-sm font-medium transition-all ${
                          executionType === "custom_script"
                            ? "border-[#007c89] bg-white text-[#007c89]"
                            : "border-[#d9cfba] bg-white/70 text-[#6b6257] hover:border-[#241c15]"
                        }`}
                      >
                        <Terminal className="h-4 w-4" /> Custom Command / Script
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#403b33] mb-2">Docker Image *</label>
                    <input
                      id="agent-docker-image"
                      type="text"
                      value={dockerImage}
                      onChange={(e) => setDockerImage(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all font-mono text-sm"
                      placeholder="ghcr.io/user/agent:latest"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#403b33] mb-2">Entrypoint Command</label>
                    <input
                      id="agent-docker-command"
                      type="text"
                      value={dockerCommand}
                      onChange={(e) => setDockerCommand(e.target.value)}
                      className="w-full px-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all font-mono text-sm"
                      placeholder={executionType === "custom_script" ? "python run.py" : "Optional command override, usually blank"}
                      required={executionType === "custom_script"}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#403b33] mb-2">Source Repo URL</label>
                    <input
                      id="agent-source-repo-url"
                      type="url"
                      value={sourceRepoUrl}
                      onChange={(e) => setSourceRepoUrl(e.target.value)}
                      className="w-full px-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all font-mono text-sm"
                      placeholder="https://github.com/user/agent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#403b33] mb-2">Required Environment Keys</label>
                    <div className="flex gap-2">
                      <input
                        id="agent-env-var"
                        type="text"
                        value={envVarDraft}
                        onChange={(e) => setEnvVarDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addEnvVar();
                          }
                        }}
                        className="min-w-0 flex-1 px-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all font-mono text-sm"
                        placeholder="OPENAI_API_KEY"
                      />
                      <button
                        type="button"
                        onClick={addEnvVar}
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-[#241c15] bg-[#ffe01b] text-[#241c15]"
                        aria-label="Add environment key"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {requiredEnvVars.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {requiredEnvVars.map((key) => (
                          <span
                            key={key}
                            className="inline-flex items-center gap-2 rounded-full border border-[#8fcac4] bg-white px-3 py-1.5 text-xs font-mono text-[#004e56]"
                          >
                            {key}
                            <button type="button" onClick={() => removeEnvVar(key)} aria-label={`Remove ${key}`}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#403b33] mb-2">Timeout Seconds *</label>
                    <input
                      id="agent-timeout-seconds"
                      type="number"
                      min={1}
                      max={600}
                      value={timeoutSeconds}
                      onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                      required
                      className="w-full px-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all"
                    />
                  </div>
                </div>
              )}

              {registrationMode === "prebuilt" && (
                <div>
                <label className="block text-sm font-medium text-[#403b33] mb-2">Model *</label>
                <select
                  id="agent-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all"
                >
                  {selectedProvider?.models.map((m) => (
                    <option key={m} value={m} className="bg-gray-900">{m}</option>
                  ))}
                </select>
              </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#403b33] mb-2">System Prompt *</label>
                <textarea
                  id="agent-system-prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  required
                  minLength={10}
                  rows={6}
                  className="w-full px-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all resize-none font-mono text-sm"
                  placeholder="You are a helpful AI assistant that..."
                />
              </div>
            </div>

            <button
              id="register-agent-submit"
              type="submit"
              disabled={loading || authLoading || !canRegister}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-[20px] bg-[#ffe01b] border border-[#241c15] text-[#241c15] font-semibold text-lg hover:bg-[#f6d90b] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-black/10"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Register Agent
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
