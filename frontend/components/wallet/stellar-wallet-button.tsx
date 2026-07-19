"use client";

import { useState } from "react";
import { Wallet, Unplug, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { connectFreighterWallet } from "@/lib/stellar-wallet";

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function StellarWalletButton({ compact = false }: { compact?: boolean }) {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;

  const connect = async () => {
    setLoading(true);
    setError("");
    try {
      const wallet = await connectFreighterWallet();
      await api.connectWallet({
        stellar_wallet_address: wallet.address,
        stellar_wallet_network: wallet.network,
        signature_message: wallet.signatureMessage,
        signature: wallet.signature,
      });
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    setError("");
    try {
      await api.disconnectWallet();
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet disconnect failed.");
    } finally {
      setLoading(false);
    }
  };

  const address = user.stellar_wallet_address;

  return (
    <div className="relative">
      {address ? (
        <button
          onClick={disconnect}
          disabled={loading}
          className="flex items-center gap-2 rounded-full border border-[#8fcac4] bg-[#d8f3f0] px-3 py-2 text-sm font-medium text-[#004e56] transition-all hover:bg-[#c8ebe7] disabled:opacity-60"
          title="Disconnect Stellar wallet"
        >
          <Wallet className="h-4 w-4" />
          {compact ? shortAddress(address) : `Freighter ${shortAddress(address)}`}
          <Unplug className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          onClick={connect}
          disabled={loading}
          className="flex items-center gap-2 rounded-full border border-[#241c15] bg-[#ffe01b] px-3 py-2 text-sm font-semibold text-[#241c15] transition-all hover:bg-[#f6d90b] disabled:opacity-60"
        >
          <Wallet className="h-4 w-4" />
          {loading ? "Connecting..." : compact ? "Wallet" : "Connect Stellar Wallet"}
        </button>
      )}
      {error && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#efb4b4] bg-[#fbe7e7] p-3 text-xs text-[#a12a2a] shadow-xl">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
