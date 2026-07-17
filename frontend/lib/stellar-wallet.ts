import {
  getNetwork,
  isConnected,
  requestAccess,
  signMessage,
} from "@stellar/freighter-api";

function readError(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Freighter request failed.";
}

function signatureToBase64(value: string | Uint8Array | null) {
  if (!value) return "";
  if (typeof value === "string") return value;
  let binary = "";
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fail(error: unknown, fallback: string): never {
  throw new Error(readError(error) || fallback);
}

export async function connectFreighterWallet() {
  const connected = await isConnected();
  if (connected.error) fail(connected.error, "Freighter wallet not found.");
  if (!connected.isConnected) {
    throw new Error("Freighter wallet not found. Install/unlock Freighter in this browser, then refresh AgentTrust.");
  }

  const access = await requestAccess();
  if (access.error) fail(access.error, "Freighter access rejected.");
  const address = access.address;
  if (!/^G[A-Z2-7]{55}$/.test(address)) {
    throw new Error("Freighter returned an invalid Stellar public key.");
  }

  const networkInfo = await getNetwork();
  if (networkInfo.error) fail(networkInfo.error, "Could not read Freighter network.");
  const network = (networkInfo.network || "testnet").toLowerCase();

  const signatureMessage = [
    "AgentTrust wallet ownership",
    `Address: ${address}`,
    `Network: ${network}`,
    `Time: ${new Date().toISOString()}`,
  ].join("\n");

  const signed = await signMessage(signatureMessage, {
    address,
    networkPassphrase: networkInfo.networkPassphrase,
  });
  if (signed.error) fail(signed.error, "Freighter signature rejected.");
  if (signed.signerAddress !== address) {
    throw new Error("Freighter signed with a different account.");
  }

  const signature = signatureToBase64(signed.signedMessage);
  if (!signature) throw new Error("Freighter did not return a signature.");

  return { address, network, signatureMessage, signature };
}
