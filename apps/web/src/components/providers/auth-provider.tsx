"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAppStore, type User } from "@/lib/store";

const AUTH_KEY = "glamo_nepal_auth";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  tenantId: string | null;
};

export type LoginPortal = "admin" | "client";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, portal?: LoginPortal) => Promise<boolean>;
  logout: () => void;
  postLoginPath: (user: AuthUser | User) => string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    tenantId: user.tenantId,
  };
}

export function postLoginPathForUser(_user: AuthUser | User): string {
  // Glamo Nepal is single-store — no super-admin portal
  void _user;
  return "/dashboard";
}

function restoreSession(): AuthUser | null {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as AuthUser;
    const users = useAppStore.getState().users;
    const match =
      users.find((u) => u.id === parsed.id) ??
      users.find((u) => u.email === parsed.email.toLowerCase());
    if (!match || match.active === false || match.status === "Inactive") {
      localStorage.removeItem(AUTH_KEY);
      useAppStore.getState().setCurrentUserId(null);
      return null;
    }
    const authUser = toAuthUser(match);
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser));
    useAppStore.getState().setCurrentUserId(match.id);
    return authUser;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    useAppStore.getState().setCurrentUserId(null);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const finish = () => {
      setUser(restoreSession());
      setIsLoading(false);
    };

    const persistApi = useAppStore.persist;
    if (persistApi.hasHydrated()) {
      finish();
      return;
    }

    const unsub = persistApi.onFinishHydration(() => finish());
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string, _portal?: LoginPortal) => {
    void _portal;
    const matched = useAppStore.getState().authenticate(email, password);
    if (!matched) return false;

    const authUser = toAuthUser(matched);
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser));
    setUser(authUser);
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    useAppStore.getState().setCurrentUserId(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, postLoginPath: postLoginPathForUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
