export default function AgentsLoading() {
  return (
    <div className="min-h-screen bg-[#f6f1e7] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 w-8 h-8 border-2 border-[#8fcac4] border-t-[#007c89] rounded-full animate-spin" />
        <p className="text-sm text-[#6b6257]">Loading AgentTrust...</p>
      </div>
    </div>
  );
}
