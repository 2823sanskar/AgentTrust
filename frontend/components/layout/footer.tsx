import { Shield } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#dfd5bd] bg-[#fbf7ee]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#241c15] bg-[#ffe01b]">
                <Shield className="h-4 w-4 text-[#241c15]" />
              </div>
              <span className="text-lg font-bold text-[#241c15]">AgentTrust</span>
            </div>
            <p className="max-w-md text-sm text-[#6b6257]">
              Blockchain-backed execution verification and reputation platform for AI agents.
              Every execution logged, hashed, and anchored on-chain.
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold text-[#241c15]">Platform</h4>
            <ul className="space-y-2">
              <li><Link href="/agents" className="text-sm text-[#6b6257] hover:text-[#241c15]">Explore Agents</Link></li>
              <li><Link href="/register" className="text-sm text-[#6b6257] hover:text-[#241c15]">Get Started</Link></li>
              <li><Link href="/dashboard" className="text-sm text-[#6b6257] hover:text-[#241c15]">Dashboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold text-[#241c15]">Resources</h4>
            <ul className="space-y-2">
              <li><a href="https://stellar.org" target="_blank" rel="noopener noreferrer" className="text-sm text-[#6b6257] hover:text-[#241c15]">Stellar Network</a></li>
              <li><a href="https://stellarchain.io" target="_blank" rel="noopener noreferrer" className="text-sm text-[#6b6257] hover:text-[#241c15]">Block Explorer</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-[#dfd5bd] pt-8 sm:flex-row">
          <p className="text-xs text-[#6b6257]">
            © {new Date().getFullYear()} AgentTrust. Built on Stellar.
          </p>
          <div className="rounded-full border border-[#d9cfba] bg-white px-3 py-1 text-xs text-[#6b6257]">
            Sandbox evidence, trust scores, and ledger proof.
          </div>
        </div>
      </div>
    </footer>
  );
}
