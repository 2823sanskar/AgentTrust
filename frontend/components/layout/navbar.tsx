"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Menu,
  X,
  LogOut,
  User,
  LogIn,
  UserPlus,
} from "lucide-react";
import { StellarWalletButton } from "@/components/wallet/stellar-wallet-button";
import { AgentTrustLogo } from "@/components/brand/AgentTrustLogo";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/agents", label: "Explore Agents" },
    ...(isAuthenticated
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/agents/register", label: "Register Agent" },
        ]
      : []),
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#dfd5bd] bg-[#f6f1e7]/95 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex shrink-0 items-center" aria-label="AgentTrust home">
            <AgentTrustLogo className="h-auto w-[150px] sm:w-[178px]" priority />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname === link.href
                    ? "bg-[#ffe01b] text-[#241c15]"
                    : "text-[#6b6257] hover:bg-white hover:text-[#241c15]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <StellarWalletButton compact />
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2 rounded-full text-sm text-[#6b6257] hover:bg-white hover:text-[#241c15] transition-all"
                >
                  <User className="h-4 w-4" />
                  {user?.name}
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-3 py-2 rounded-full text-sm text-[#6b6257] hover:text-red-700 hover:bg-red-100 transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-[#241c15] hover:bg-white transition-all"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-2 rounded-full border border-[#241c15] bg-[#ffe01b] px-4 py-2 text-sm font-semibold text-[#241c15] transition-transform hover:-translate-y-0.5"
                >
                  <UserPlus className="h-4 w-4" />
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-[#241c15] hover:bg-white"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-[#dfd5bd] mt-2">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    pathname === link.href
                      ? "bg-[#ffe01b] text-[#241c15]"
                      : "text-[#6b6257] hover:bg-white hover:text-[#241c15]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 pt-2 border-t border-[#dfd5bd]">
                {isAuthenticated ? (
                  <>
                    <div className="px-4 py-3">
                      <StellarWalletButton />
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-[#6b6257] hover:bg-white hover:text-[#241c15]"
                    >
                      <User className="h-4 w-4" /> {user?.name}
                    </Link>
                    <button
                      onClick={() => { logout(); setMobileOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-[#a12a2a] hover:bg-[#fbe7e7]"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-[#6b6257] hover:bg-white hover:text-[#241c15]">
                      Sign In
                    </Link>
                    <Link href="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-semibold text-[#241c15] hover:bg-[#ffe01b]">
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
