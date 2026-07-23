"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, TokenResponse } from "@/types";
import { api, clearClientAuthStorage, isAuthExpiredError } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem("access_token") ||
      window.localStorage.getItem("token") ||
      window.localStorage.getItem("authToken") ||
      getCookie("access_token") ||
      getCookie("token")
    );
  } catch {
    return null;
  }
}

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const rawUser = window.localStorage.getItem("agenttrust_user");
    const legacyUser = window.localStorage.getItem("user");
    return rawUser
      ? (JSON.parse(rawUser) as User)
      : legacyUser
        ? (JSON.parse(legacyUser) as User)
        : null;
  } catch {
    return null;
  }
}

function setStoredToken(token: string) {
  try {
    window.localStorage.setItem("access_token", token);
    window.localStorage.setItem("token", token);
    if (typeof document !== "undefined") {
      document.cookie = `access_token=${token}; Path=/; SameSite=Lax; Max-Age=86400`;
      document.cookie = `token=${token}; Path=/; SameSite=Lax; Max-Age=86400`;
    }
  } catch {
    throw new Error("Browser storage is blocked. Enable site storage, then sign in again.");
  }
}

function setStoredUser(user: User) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("agenttrust_user", JSON.stringify(user));
  } catch {
    // Token storage is enough for authenticated API calls.
  }
}

function clearStoredToken() {
  clearClientAuthStorage();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const expireSession = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setIsLoading(false);
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/register")
    ) {
      window.location.replace("/login");
    }
  }, []);

  const loadUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
      setIsLoading(false);
    }
    try {
      const userData = await api.me();
      setUser(userData);
      setStoredUser(userData);
    } catch (err) {
      if (isAuthExpiredError(err) || !storedUser) {
        expireSession();
        return;
      }
    } finally {
      setIsLoading(false);
    }
  }, [expireSession]);

  useEffect(() => {
    void Promise.resolve().then(loadUser);
  }, [loadUser]);

  useEffect(() => {
    window.addEventListener("agenttrust:auth-expired", expireSession);
    return () => window.removeEventListener("agenttrust:auth-expired", expireSession);
  }, [expireSession]);

  const handleAuthResponse = (response: TokenResponse) => {
    setStoredToken(response.access_token);
    setStoredUser(response.user);
    setUser(response.user);
    setIsLoading(false);
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await api.login({ email, password });
      handleAuthResponse(response);
      return true;
    } catch (err) {
      console.error("Auth context login error:", err);
      throw err;
    }
  };

  const register = async (name: string, email: string, password: string, role: string) => {
    const response = await api.register({ name, email, password, role });
    handleAuthResponse(response);
  };

  const refreshUser = async () => {
    const userData = await api.me();
    setUser(userData);
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
