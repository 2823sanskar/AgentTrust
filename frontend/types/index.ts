// TypeScript type definitions for AgentTrust frontend

export interface User {
  id: string;
  name: string;
  email: string;
  role: "developer" | "user";
  stellar_wallet_address: string | null;
  stellar_wallet_network: string | null;
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
  provider: "openrouter" | "browser" | "external_docker";
  model: string;
  system_prompt: string;
  category: string | null;
  agent_type: "prebuilt" | "custom_docker" | "custom_script";
  docker_image: string | null;
  docker_command: string | null;
  entrypoint_command: string | null;
  required_env_vars: string[] | null;
  source_repo_url: string | null;
  timeout_seconds: number | null;
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

export interface RunListResponse {
  runs: Run[];
  total: number;
  page: number;
  page_size: number;
}

export interface AgentCreate {
  name: string;
  description?: string;
  provider: "openrouter" | "browser" | "external_docker";
  model: string;
  system_prompt: string;
  agent_type?: "prebuilt" | "custom_docker" | "custom_script";
  docker_image?: string;
  docker_command?: string;
  entrypoint_command?: string;
  required_env_vars?: string[];
  source_repo_url?: string;
  timeout_seconds?: number;
  category?: string;
}

export interface ActionLogEntry {
  step: number;
  action: string;
  tool?: string;
  target?: string;
  note?: string;
  input?: Record<string, unknown> | string;
  output?: string;
  timestamp?: string;
  status?: string;
}

export interface Run {
  id: string;
  agent_id: string;
  user_id: string;
  task: string;
  response: string | null;
  action_log: ActionLogEntry[] | null;
  container_stdout: string | null;
  container_stderr: string | null;
  exit_code: number | null;
  status: "success" | "failure" | "pending" | "blocked" | "running";
  execution_time: number | null;
  is_interactive: boolean;
  container_id: string | null;
  vnc_port: number | null;
  websockify_port: number | null;
  session_token_preview: string | null;
  desktop_status: "pending" | "running" | "stopping" | "stopped" | "failed" | "timed_out" | string;
  last_heartbeat: string | null;
  created_at: string;
  hash: string | null;
  stellar_transaction: string | null;
  stellar_network: "mainnet" | "testnet" | string | null;
  stellar_ledger_sequence: number | null;
  anchored_at: string | null;
  anchor_status: "anchored" | "pending_anchor" | "failed_anchor" | string | null;
  agent_name: string | null;
  user_name: string | null;
  user_stellar_wallet_address: string | null;
  user_stellar_wallet_network: string | null;
  routing_mode?: "cloud_sandbox" | "local_engine" | string;
  stream_url?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  remote_display_url?: string | null;
}

export interface DesktopSessionStatus {
  run_id: string;
  desktop_status: "pending" | "running" | "stopping" | "stopped" | "failed" | "timed_out" | string;
  vnc_port: number | null;
  websockify_port: number | null;
  container_id: string | null;
  created_at: string;
  last_heartbeat: string | null;
}

export interface DesktopConnectInfo {
  run_id: string;
  websockify_port: number | null;
  session_token: string | null;
  status: string;
}

export interface DesktopHeartbeatResponse {
  status: "ok" | string;
  last_heartbeat: string;
}

export interface DesktopStopResponse {
  status: string;
  desktop_status: string;
  run?: Run;
}

export interface VerificationResult {
  run_id: string;
  verification_status: "verified" | "tampered" | "unanchored";
  stored_hash: string | null;
  computed_hash: string | null;
  hashes_match?: boolean;
  stellar_verified?: boolean;
  tx_hash?: string | null;
  is_valid: boolean;
  stellar_transaction: string | null;
  stellar_network?: string | null;
  stellar_ledger_sequence?: number | null;
  timestamp?: string | null;
  explorer_url?: string | null;
  anchored_at?: string | null;
  run_details: {
    agent_id: string;
    agent_name?: string | null;
    user_name?: string | null;
    user_stellar_wallet_address?: string | null;
    user_stellar_wallet_network?: string | null;
    task: string;
    status: string;
    execution_time?: number | null;
    exit_code?: number | null;
    stellar_network?: string | null;
    created_at: string;
  };
}

export interface TrustScore {
  agent_id: string;
  trust_score: number;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  verified_runs: number;
  reputation_grade: string;
}
