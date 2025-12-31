"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useVault } from "@/app/components/providers/VaultProvider";

const AUTH_ROUTES = ["/login", "/signup", "/unlock"];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isUnlocked } = useVault();
  const hasRefreshed = useRef(false);
  const fetchPatched = useRef(false);

  // Attach CSRF header automatically for same-origin non-GET requests
  useEffect(() => {
    if (fetchPatched.current) return;
    if (typeof window === "undefined") return;
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" || input instanceof URL ? new URL(input, window.location.origin) : new URL((input as Request).url);
      const method = (init?.method || (input as Request)?.method || "GET").toUpperCase();
      const isSameOrigin = url.origin === window.location.origin;

      if (isSameOrigin && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has("x-csrf-token")) {
          const match = document.cookie.split('; ').find((c) => c.startsWith('csrfToken='));
          if (match) {
            const token = match.split('=')[1];
            if (token) headers.set('x-csrf-token', decodeURIComponent(token));
          }
        }
        return originalFetch(input, { ...init, headers });
      }

      return originalFetch(input, init);
    };
    fetchPatched.current = true;
  }, []);

  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (isAuthRoute) return;

    let cancelled = false;

    const check = async () => {
      try {
        if (!hasRefreshed.current) {
          hasRefreshed.current = true;
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
          });

          if (!refreshRes.ok) {
            if (!cancelled) router.replace("/login");
            return;
          }
        }

        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!res.ok) {
          if (!cancelled) router.replace("/login");
          return;
        }

        if (!isUnlocked && !cancelled) {
          router.replace("/unlock");
        }
      } catch {
        if (!cancelled) router.replace("/login");
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [isAuthRoute, isUnlocked, router]);

  // ✅ Never block rendering
  return <>{children}</>;
}