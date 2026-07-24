"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/api";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { AgentTrustLogo } from "@/components/brand/AgentTrustLogo";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.replace("/dashboard");
    }
  }, [isAuthenticated]);

  const togglePasswordVisibility = useCallback((event?: Event | React.SyntheticEvent) => {
    event?.preventDefault();
    setShowPassword((visible) => {
      const nextVisible = !visible;
      if (passwordInputRef.current) {
        passwordInputRef.current.type = nextVisible ? "text" : "password";
      }
      return nextVisible;
    });
  }, []);

  useEffect(() => {
    const toggleButton = document.getElementById("login-password-toggle");
    toggleButton?.addEventListener("click", togglePasswordVisibility);

    return () => {
      toggleButton?.removeEventListener("click", togglePasswordVisibility);
    };
  }, [togglePasswordVisibility]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const success = await login(email, password);
      if (success && typeof window !== "undefined") {
        router.replace("/dashboard");
        window.setTimeout(() => {
          window.location.href = "/dashboard";
        }, 50);
      }
    } catch (err: unknown) {
      console.error("Login submission error:", err);
      setError(getErrorMessage(err, "Login failed"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f6f1e7]">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#d8f3f0] rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[128px]" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link href="/" className="mb-5 inline-flex" aria-label="AgentTrust home">
            <AgentTrustLogo className="h-auto w-[230px]" priority />
          </Link>
          <h1 className="text-2xl font-bold text-[#241c15]">Welcome back</h1>
          <p className="text-[#6b6257] mt-1">Sign in to your AgentTrust account</p>
        </div>

        {/* Form card */}
        <div className="rounded-[24px] border border-[#d9cfba] bg-white backdrop-blur-sm p-8">
          <form id="login-form" onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div id="login-error" role="alert" className="p-3 rounded-lg bg-[#fbe7e7] border border-[#efb4b4] text-sm text-[#a12a2a]">
                {error}
              </div>
            )}
            <div id="login-native-error" role="alert" hidden className="p-3 rounded-lg bg-[#fbe7e7] border border-[#efb4b4] text-sm text-[#a12a2a]" />

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-[#403b33] mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6257]" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-[#403b33] mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6257]" />
                <input
                  id="login-password"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-12 py-3 rounded-[20px] bg-white border border-[#d9cfba] text-[#241c15] placeholder-[#b7aa8d] focus:outline-none focus:border-[#007c89] focus:ring-1 focus:ring-[#007c89]/20 transition-all"
                  placeholder="••••••••"
                />
                <button
                  id="login-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#6b6257] hover:bg-[#f6f1e7] hover:text-[#403b33]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[20px] bg-[#ffe01b] border border-[#241c15] text-[#241c15] font-semibold hover:bg-[#f6d90b] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-black/10"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#6b6257]">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-[#007c89] hover:text-[#004e56] font-medium">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
