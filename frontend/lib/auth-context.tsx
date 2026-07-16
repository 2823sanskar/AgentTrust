"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, TokenResponse } from "@/types";
import { api } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStoredToken() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("access_token");
  } catch {
    return null;
  }
}

function setStoredToken(token: string) {
  try {
    window.localStorage.setItem("access_token", token);
  } catch {
    throw new Error("Browser storage is blocked. Enable site storage, then sign in again.");
  }
}

function clearStoredToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("access_token");
  } catch {
    // Nothing else to clear when browser storage is unavailable.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const userData = await api.me();
      setUser(userData);
    } catch {
      clearStoredToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadUser);
  }, [loadUser]);

  const handleAuthResponse = (response: TokenResponse) => {
    setStoredToken(response.access_token);
    setUser(response.user);
  };

  const login = async (email: string, password: string) => {
    const response = await api.login({ email, password });
    handleAuthResponse(response);
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
