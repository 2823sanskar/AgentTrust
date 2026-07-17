export default function AgentsLoading() {
  return (
    <div className="min-h-screen bg-[#060612] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading AgentTrust...</p>
      </div>
    </div>
  );
}
