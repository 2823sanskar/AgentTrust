"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { getErrorMessage } from "@/lib/api";
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, User, Code2, Users } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"developer" | "user">("developer");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password, role);
      window.location.assign("/dashboard");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#060612]">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[128px]" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 mb-4">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-gray-500 mt-1">Join AgentTrust and build your reputation</p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8">
          <form id="register-form" onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div id="register-error" role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}
            <div id="register-native-error" role="alert" hidden className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400" />

            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  id="register-role-developer"
                  type="button"
                  onClick={() => setRole("developer")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    role === "developer"
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                      : "border-white/10 bg-white/[0.02] text-gray-500 hover:border-white/20"
                  }`}
                >
                  <Code2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Developer</span>
                </button>
                <button
                  id="register-role-user"
                  type="button"
                  onClick={() => setRole("user")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    role === "user"
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                      : "border-white/10 bg-white/[0.02] text-gray-500 hover:border-white/20"
                  }`}
                >
                  <Users className="h-5 w-5" />
                  <span className="text-sm font-medium">User</span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="register-name" className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full pl-10 pr-12 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all"
                  placeholder="Min. 8 characters"
                />
                <button
                  id="register-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="register-confirm-password" className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  id="register-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all"
                  placeholder="Repeat password"
                />
              </div>
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
(() => {
  if (window.__agentTrustRegisterFallbackInstalled) return;
  window.__agentTrustRegisterFallbackInstalled = true;
  const apiBase = ${JSON.stringify(API_BASE)};
  let selectedRole = "developer";
  const showError = (message) => {
    const fallbackError = document.getElementById("register-native-error");
    if (!fallbackError) return;
    fallbackError.textContent = message || "Registration failed";
    fallbackError.hidden = false;
  };
  const setRole = (role) => {
    selectedRole = role;
    const developer = document.getElementById("register-role-developer");
    const user = document.getElementById("register-role-user");
    developer?.classList.toggle("border-cyan-500/50", role === "developer");
    developer?.classList.toggle("bg-cyan-500/10", role === "developer");
    developer?.classList.toggle("text-cyan-400", role === "developer");
    user?.classList.toggle("border-cyan-500/50", role === "user");
    user?.classList.toggle("bg-cyan-500/10", role === "user");
    user?.classList.toggle("text-cyan-400", role === "user");
  };
  const setup = () => {
    const form = document.getElementById("register-form");
    const name = document.getElementById("register-name");
    const email = document.getElementById("register-email");
    const password = document.getElementById("register-password");
    const confirmPassword = document.getElementById("register-confirm-password");
    const toggle = document.getElementById("register-password-toggle");
    const submit = document.getElementById("register-submit");
    const developer = document.getElementById("register-role-developer");
    const user = document.getElementById("register-role-user");
    if (!form || !name || !email || !password || !confirmPassword) return;
    if (developer && !developer.dataset.nativeReady) {
      developer.dataset.nativeReady = "true";
      developer.addEventListener("click", () => setRole("developer"));
    }
    if (user && !user.dataset.nativeReady) {
      user.dataset.nativeReady = "true";
      user.addEventListener("click", () => setRole("user"));
    }
    if (toggle && !toggle.dataset.nativeReady) {
      toggle.dataset.nativeReady = "true";
      toggle.addEventListener("click", () => {
        const visible = password.type === "text";
        password.type = visible ? "password" : "text";
        toggle.setAttribute("aria-label", visible ? "Show password" : "Hide password");
        toggle.setAttribute("aria-pressed", String(!visible));
      });
    }
    if (form.dataset.nativeReady) return;
    form.dataset.nativeReady = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fallbackError = document.getElementById("register-native-error");
      if (fallbackError) {
        fallbackError.hidden = true;
        fallbackError.textContent = "";
      }
      if (password.value !== confirmPassword.value) {
        showError("Passwords do not match");
        return;
      }
      if (password.value.length < 8) {
        showError("Password must be at least 8 characters");
        return;
      }
      submit?.setAttribute("disabled", "true");
      try {
        const response = await fetch(apiBase + "/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.value, email: email.value, password: password.value, role: selectedRole }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.detail || "Registration failed");
        window.localStorage.setItem("access_token", payload.access_token);
        window.location.assign("/dashboard");
      } catch (error) {
        showError(error instanceof Error ? error.message : "Registration failed");
      } finally {
        submit?.removeAttribute("disabled");
      }
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true });
  else setup();
})();
          `,
        }}
      />
    </div>
  );
}
