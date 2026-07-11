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
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const userData = await api.me();
      setUser(userData);
    } catch {
      localStorage.removeItem("access_token");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadUser);
  }, [loadUser]);

  const handleAuthResponse = (response: TokenResponse) => {
    localStorage.setItem("access_token", response.access_token);
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

  const logout = () => {
    localStorage.removeItem("access_token");
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
