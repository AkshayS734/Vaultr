"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useVault } from "@/app/components/providers/VaultProvider";

const AUTH_ROUTES = ["/login", "/signup", "/unlock"];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isUnlocked } = useVault();

  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (isAuthRoute) return;

    const check = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!res.ok) {
          router.replace("/login");
          return;
        }

        if (!isUnlocked) {
          router.replace("/unlock");
        }
      } catch {
        router.replace("/login");
      }
    };

    check();
  }, [isAuthRoute, isUnlocked, router]);

  // ✅ Never block rendering
  return <>{children}</>;
}