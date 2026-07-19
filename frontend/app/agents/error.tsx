"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function AgentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Agents route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f6f1e7] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <AlertCircle className="h-10 w-10 text-[#a12a2a] mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-[#241c15] mb-2">Agent page failed to load</h1>
        <p className="text-sm text-[#6b6257] mb-6">
          Refresh this section. If it keeps failing, sign in again and confirm the backend is running.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ffe01b] border border-[#241c15] text-[#241c15] font-medium hover:bg-[#f6d90b] transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
