type FreighterResult<T> = T | { error?: string; address?: string; network?: string };

interface FreighterApi {
  isAllowed?: () => Promise<boolean | { isAllowed?: boolean; error?: string }>;
  setAllowed?: () => Promise<boolean | { error?: string }>;
  getAddress?: () => Promise<FreighterResult<string>>;
  getNetwork?: () => Promise<FreighterResult<string>>;
}

declare global {
  interface Window {
    freighterApi?: FreighterApi;
  }
}

function readResult(value: FreighterResult<string>, key: "address" | "network") {
  if (typeof value === "string") return value;
  if (value.error) throw new Error(value.error);
  return value[key] ?? "";
}

export function isFreighterAvailable() {
  return typeof window !== "undefined" && Boolean(window.freighterApi);
}

export async function connectFreighterWallet() {
  const freighter = window.freighterApi;
  if (!freighter) {
    throw new Error("Freighter wallet not found. Install Freighter, then refresh AgentTrust.");
  }

  const allowedResult = freighter.isAllowed ? await freighter.isAllowed() : false;
  const isAllowed = typeof allowedResult === "boolean" ? allowedResult : Boolean(allowedResult.isAllowed);
  if (!isAllowed && freighter.setAllowed) {
    const setAllowedResult = await freighter.setAllowed();
    if (typeof setAllowedResult !== "boolean" && setAllowedResult.error) {
      throw new Error(setAllowedResult.error);
    }
  }

  if (!freighter.getAddress) {
    throw new Error("Freighter address API not available. Update the Freighter extension.");
  }

  const address = readResult(await freighter.getAddress(), "address");
  if (!/^G[A-Z2-7]{55}$/.test(address)) {
    throw new Error("Freighter returned an invalid Stellar public key.");
  }

  const network = freighter.getNetwork
    ? readResult(await freighter.getNetwork(), "network") || "testnet"
    : "testnet";

  return { address, network: network.toLowerCase() };
}
