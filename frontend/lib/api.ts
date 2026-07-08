// API client with JWT token injection

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async register(data: { name: string; email: string; password: string; role: string }) {
    return this.request<import("@/types").TokenResponse>("/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<import("@/types").TokenResponse>("/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async me() {
    return this.request<import("@/types").User>("/me");
  }

  // Agents
  async getAgents(params?: {
    search?: string;
    provider?: string;
    category?: string;
    page?: number;
    page_size?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.provider) searchParams.set("provider", params.provider);
    if (params?.category) searchParams.set("category", params.category);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
    const qs = searchParams.toString();
    return this.request<import("@/types").AgentListResponse>(`/agents${qs ? `?${qs}` : ""}`);
  }

  async getAgent(id: string) {
    return this.request<import("@/types").Agent>(`/agents/${id}`);
  }

  async createAgent(data: import("@/types").AgentCreate) {
    return this.request<import("@/types").Agent>("/agents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAgent(id: string, data: Partial<import("@/types").AgentCreate>) {
    return this.request<import("@/types").Agent>(`/agents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(id: string) {
    return this.request(`/agents/${id}`, { method: "DELETE" });
  }

  // Executions
  async execute(data: { agent_id: string; task: string }) {
    return this.request<import("@/types").Run>("/execute", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getRun(id: string) {
    return this.request<import("@/types").Run>(`/runs/${id}`);
  }

  async getRuns(params?: { agent_id?: string; user_id?: string; page?: number; page_size?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.agent_id) searchParams.set("agent_id", params.agent_id);
    if (params?.user_id) searchParams.set("user_id", params.user_id);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
    const qs = searchParams.toString();
    return this.request<import("@/types").RunListResponse>(`/runs${qs ? `?${qs}` : ""}`);
  }

  // Trust
  async getTrustScore(agentId: string) {
    return this.request<import("@/types").TrustScore>(`/trust/${agentId}`);
  }

  // Verification
  async verifyRun(runId: string) {
    return this.request<import("@/types").VerificationResult>(`/verify/${runId}`);
  }
}

export const api = new ApiClient();
