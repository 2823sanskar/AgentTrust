export type StellarNetwork = "mainnet" | "testnet";

const configuredNetwork = (
  process.env.NEXT_PUBLIC_STELLAR_NETWORK || "mainnet"
)
  .trim()
  .toLowerCase();

if (!["mainnet", "public", "pubnet"].includes(configuredNetwork)) {
  throw new Error(
    "AgentTrust is Mainnet-only. Set NEXT_PUBLIC_STELLAR_NETWORK=mainnet.",
  );
}

export const ACTIVE_STELLAR_NETWORK = "mainnet" as const;

export function normalizeStellarNetwork(
  network?: string | null,
): StellarNetwork | null {
  if (network === undefined) return ACTIVE_STELLAR_NETWORK;
  if (!network) return null;

  const normalized = network.trim().toLowerCase();
  if (["mainnet", "public", "pubnet"].includes(normalized)) return "mainnet";
  if (normalized === "testnet") return "testnet";
  return null;
}

export function stellarTransactionUrl(
  transactionHash: string,
  network?: string | null,
): string | null {
  const normalized = normalizeStellarNetwork(network);
  if (!normalized) return null;

  const explorerNetwork = normalized === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${explorerNetwork}/tx/${transactionHash}`;
}
