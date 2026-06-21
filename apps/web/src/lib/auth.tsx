"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "./types";
import { api, clearAccessToken, setAccessToken } from "./api";
import { getSupabase } from "./supabase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  completeSession: (accessToken: string) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const completeSession = useCallback(async (accessToken: string) => {
    setAccessToken(accessToken);
    const applicationUser = await api.bootstrapAuth();
    setUser(applicationUser);
    return applicationUser;
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    try {
      const supabase = getSupabase();
      supabase.auth.getSession()
        .then(async ({ data, error }) => {
          if (error) throw error;
          if (!active) return;
          if (data.session) await completeSession(data.session.access_token);
          else clearAccessToken();
        })
        .catch(() => {
          clearAccessToken();
          if (active) setUser(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      const subscription = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (session) setAccessToken(session.access_token);
        if (event === "SIGNED_OUT") {
          clearAccessToken();
          setUser(null);
        }
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
    } catch {
      clearAccessToken();
      setLoading(false);
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [completeSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    completeSession,
    logout() {
      try {
        void getSupabase().auth.signOut();
      } finally {
        clearAccessToken();
        setUser(null);
        router.push("/");
      }
    },
  }), [completeSession, loading, router, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function useRoleGuard(role: User["role"]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=/${role}`);
    else if (user.role !== role) router.replace(`/${user.role}`);
  }, [loading, role, router, user]);
  return { user: user?.role === role ? user : null, loading };
}
