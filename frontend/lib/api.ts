// API client with JWT token injection

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "/api"
).replace(/\/+$/, "");

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type ApiErrorBody = {
  detail?: unknown;
  message?: unknown;
  error?: unknown;
};

export class ApiRequestError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.detail = detail;
  }
}

export function isAuthExpiredError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}

const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;
const LIST_REQUEST_TIMEOUT_MS = 60_000;
const EXECUTION_REQUEST_TIMEOUT_MS = 240_000;
const DESKTOP_STOP_TIMEOUT_MS = 120_000;

export function clearClientAuthStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("access_token");
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("authToken");
    window.localStorage.removeItem("agenttrust_user");
    window.localStorage.removeItem("user");
    window.sessionStorage.clear();
    if (typeof document !== "undefined") {
      document.cookie = "access_token=; Path=/; SameSite=Lax; Max-Age=0";
      document.cookie = "token=; Path=/; SameSite=Lax; Max-Age=0";
    }
  } catch {
    // Browser storage may be blocked; the in-memory auth context still resets.
  }
}

function notifyAuthExpired() {
  clearClientAuthStorage();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("agenttrust:auth-expired"));
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

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({ detail: "Request failed" }));
  }

  const text = await response.text().catch(() => "");
  return { detail: text || "Request failed" };
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
      const localToken =
        window.localStorage.getItem("access_token") || window.localStorage.getItem("token");
      if (localToken) return localToken;

      if (typeof document !== "undefined") {
        const value = `; ${document.cookie}`;
        const partsAccess = value.split(`; access_token=`);
        if (partsAccess.length === 2) {
          const val = partsAccess.pop()?.split(";").shift();
          if (val) return val;
        }
        const partsToken = value.split(`; token=`);
        if (partsToken.length === 2) {
          const val = partsToken.pop()?.split(";").shift();
          if (val) return val;
        }
      }
      return null;
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
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response: Response;
    let controller: AbortController | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const effectiveTimeoutMs = timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    if (effectiveTimeoutMs) {
      controller = new AbortController();
      timeoutId = setTimeout(() => controller!.abort(), effectiveTimeoutMs);
    }

    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        signal: controller?.signal,
        credentials: "same-origin",
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("The backend request timed out. Please retry in a moment.");
      }
      throw new Error("Cannot connect to AgentTrust. Please make sure the backend is running.");
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await parseErrorBody(response);
      const detail =
        error.detail ??
        error.message ??
        error.error ??
        (response.status === 401 ? "Unauthorized" : "Request failed");
      const message = formatApiError(detail, `Request failed (HTTP ${response.status})`);
      if (response.status >= 500) {
        console.error("[API Error]:", {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          detail,
        });
      }
      if (response.status === 401 || response.status === 403) {
        notifyAuthExpired();
      }
      throw new ApiRequestError(message, response.status, detail);
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
    return this.request<import("@/types").AgentListResponse>(
      `/agents${qs ? `?${qs}` : ""}`,
      {},
      LIST_REQUEST_TIMEOUT_MS,
    );
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
  async execute(data: { agent_id: string; task: string; is_interactive?: boolean }) {
    // 4-minute timeout: Docker/browser runs can take a while + Stellar anchoring
    return this.request<import("@/types").Run>("/execute", {
      method: "POST",
      body: JSON.stringify(data),
    }, EXECUTION_REQUEST_TIMEOUT_MS);
  }

  async getRun(id: string) {
    return this.request<import("@/types").Run>(`/runs/${id}`);
  }

  async getRuns(params?: { agent_id?: string; page?: number; page_size?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.agent_id) searchParams.set("agent_id", params.agent_id);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
    const qs = searchParams.toString();
    return this.request<import("@/types").RunListResponse>(
      `/runs${qs ? `?${qs}` : ""}`,
      {},
      LIST_REQUEST_TIMEOUT_MS,
    );
  }

  // Trust
  async getTrustScore(agentId: string) {
    return this.request<import("@/types").TrustScore>(`/trust/${agentId}`);
  }

  // Verification
  async verifyRun(runId: string) {
    return this.request<import("@/types").VerificationResult>(`/verify/${runId}`);
  }

  async getDesktopStatus(runId: string) {
    return this.request<import("@/types").DesktopSessionStatus>(`/v1/desktop/${runId}/status`);
  }

  async getDesktopConnectInfo(runId: string) {
    return this.request<import("@/types").DesktopConnectInfo>(`/v1/desktop/${runId}/connect-info`);
  }

  async sendDesktopHeartbeat(runId: string) {
    return this.request<import("@/types").DesktopHeartbeatResponse>(
      `/v1/desktop/${runId}/heartbeat`,
      { method: "POST" },
    );
  }

  async stopDesktopSession(runId: string) {
    return this.request<import("@/types").DesktopStopResponse>(
      `/v1/desktop/${runId}/stop`,
      { method: "POST" },
      DESKTOP_STOP_TIMEOUT_MS,
    );
  }
}

export const api = new ApiClient();
