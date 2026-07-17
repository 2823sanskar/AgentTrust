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
    <div className="min-h-screen bg-[#060612] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">Agent page failed to load</h1>
        <p className="text-sm text-gray-500 mb-6">
          Refresh this section. If it keeps failing, sign in again and confirm the backend is running.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
