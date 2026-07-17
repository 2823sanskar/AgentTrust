// API client with JWT token injection

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatApiError(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") {
          return item.msg;
        }
        return null;
      })
      .filter((message): message is string => Boolean(message));

    if (messages.length) return messages.join(". ");
  }

  return fallback;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem("access_token");
    } catch {
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs?: number,
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response: Response;
    let controller: AbortController | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const effectiveTimeoutMs = timeoutMs ?? 15_000;

    if (effectiveTimeoutMs) {
      controller = new AbortController();
      timeoutId = setTimeout(() => controller!.abort(), effectiveTimeoutMs);
    }

    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        signal: controller?.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          "The request timed out. Docker and browser agent runs can take a few minutes - please try again."
        );
      }
      throw new Error("Cannot connect to AgentTrust. Please make sure the backend is running.");
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(formatApiError(error.detail, `Request failed (HTTP ${response.status})`));
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

  async connectWallet(data: {
    stellar_wallet_address: string;
    stellar_wallet_network: string;
    signature_message: string;
    signature: string;
  }) {
    return this.request<import("@/types").User>("/me/wallet", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async disconnectWallet() {
    return this.request<import("@/types").User>("/me/wallet", { method: "DELETE" });
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
    // 4-minute timeout: Docker/browser runs can take a while + Stellar anchoring
    return this.request<import("@/types").Run>("/execute", {
      method: "POST",
      body: JSON.stringify(data),
    }, 240_000);
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
