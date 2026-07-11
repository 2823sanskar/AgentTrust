// TypeScript type definitions for AgentTrust frontend

export interface User {
  id: string;
  name: string;
  email: string;
  role: "developer" | "user";
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Agent {
  id: string;
  developer_id: string;
  name: string;
  description: string | null;
  provider: "openrouter" | "browser";
  model: string;
  system_prompt: string;
  category: string | null;
  status: "active" | "inactive";
  created_at: string;
  developer_name: string | null;
  trust_score: number | null;
  total_runs: number | null;
  success_rate: number | null;
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
  page: number;
  page_size: number;
}

export interface AgentCreate {
  name: string;
  description?: string;
  provider: "openrouter" | "browser";
  model: string;
  system_prompt: string;
  category?: string;
}

export interface Run {
  id: string;
  agent_id: string;
  user_id: string;
  task: string;
  response: string | null;
  action_log: ActionLogEntry[] | null;
  status: "success" | "failure" | "pending";
  execution_time: number | null;
  created_at: string;
  hash: string | null;
  stellar_transaction: string | null;
  agent_name: string | null;
  user_name: string | null;
}

export interface ActionLogEntry {
  step: number;
  action: string;
  target: string;
  status: "success" | "failure" | "pending";
  note: string;
}

export interface RunListResponse {
  runs: Run[];
  total: number;
  page: number;
  page_size: number;
}

export interface TrustScore {
  agent_id: string;
  overall_score: number;
  success_rate: number;
  average_latency: number;
  verified_runs: number;
  total_runs: number;
  updated_at: string | null;
}

export interface VerificationResult {
  run_id: string;
  stored_hash: string | null;
  computed_hash: string;
  hashes_match: boolean;
  stellar_transaction: string | null;
  stellar_verified: boolean;
  verification_status: "verified" | "tampered" | "unanchored";
  run_details: Run;
}
