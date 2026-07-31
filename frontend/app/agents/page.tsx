"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AgentsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/execute");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f6f1e7] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#8fcac4] border-t-[#007c89] rounded-full animate-spin" />
    </div>
  );
}
