"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useVault } from "@/app/components/providers/VaultProvider";

type GuardStatus = "checking" | "redirecting" | "allowed";

const AUTH_ROUTES = ["/login", "/signup", "/unlock"];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isUnlocked } = useVault();

  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // Status is ONLY for async checks
  const [status, setStatus] = useState<GuardStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    if (isAuthRoute) return;

    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          if (!cancelled) {
            setStatus("redirecting");
            router.replace("/login");
          }
          return;
        }

        if (!isUnlocked) {
          if (!cancelled && pathname !== "/unlock") {
            setStatus("redirecting");
            router.replace("/unlock");
          }
          return;
        }

        if (!cancelled) {
          setStatus("allowed");
        }
      } catch {
        if (!cancelled) {
          setStatus("redirecting");
          router.replace("/login");
        }
      }
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [isAuthRoute, isUnlocked, pathname, router]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (status !== "allowed") {
    return (
      <div className="min-h-screen bg-[#2b2d42] text-white flex items-center justify-center">
        <div className="rounded-lg border border-[#8d99ae]/30 bg-black/20 px-4 py-3 text-sm text-[#8d99ae]">
          Securing your session – please wait...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}