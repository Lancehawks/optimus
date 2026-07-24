"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authService, isUnauthorizedError } from "@/services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children, initialUser = null, checkSession = false }) {
  const [user, setUser] = useState(initialUser);
  const [isLoading, setIsLoading] = useState(checkSession);
  const [authError, setAuthError] = useState(null);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const data = await authService.me();
      setUser(data.user);
      setAuthError(null);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setUser(null);
        try {
          await authService.logout();
        } catch {
          // The server may already consider the session invalid. Redirecting
          // still restores a usable login screen once the cookie is cleared.
        }
        router.replace("/login");
      } else {
        setAuthError("We could not verify your session. Check your connection and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (checkSession) fetchUser();
    else setIsLoading(false);
  }, [checkSession, fetchUser]);

  useEffect(() => {
    const handleExpiredSession = async () => {
      try { await authService.logout(); } catch {}
      setUser(null);
      router.replace("/login");
    };
    window.addEventListener("optimus-session-expired", handleExpiredSession);
    return () => window.removeEventListener("optimus-session-expired", handleExpiredSession);
  }, [router]);

  const login = async (email, password) => {
    const data = await authService.login({ email, password });
    setUser(data.user);
    setAuthError(null);
    router.push("/dashboard");
    return data;
  };

  const signup = async (email, password, fullName) => {
    const data = await authService.signup({ email, password, fullName });
    setUser(data.user);
    setAuthError(null);
    router.push("/dashboard");
    return data;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    router.push("/");
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, authError, retryAuth: fetchUser, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
