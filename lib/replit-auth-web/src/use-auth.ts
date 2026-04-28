import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

/** When set (e.g. from VITE_API_BASE_URL), auth routes hit this origin; otherwise paths use Vite BASE_URL. */
let externalApiOrigin: string | undefined;

export function setExternalApiOrigin(origin: string | undefined): void {
  externalApiOrigin = origin?.trim().replace(/\/+$/, "") || undefined;
}

function appBasePath(): string {
  const base = String(import.meta.env.BASE_URL ?? "/");
  if (base === "/") return "";
  return base.replace(/\/+$/, "");
}

function apiUrl(path: string): string {
  if (externalApiOrigin) {
    return `${externalApiOrigin}${path}`;
  }
  const prefix = appBasePath();
  return `${prefix}${path}`;
}

function loginReturnTo(): string {
  const p = appBasePath();
  return `${window.location.origin}${p === "" ? "" : p}`;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(apiUrl("/api/auth/user"), { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    const returnTo = loginReturnTo();
    window.location.href = `${apiUrl("/api/login")}?returnTo=${encodeURIComponent(returnTo)}`;
  }, []);

  const logout = useCallback(() => {
    window.location.href = apiUrl("/api/logout");
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
