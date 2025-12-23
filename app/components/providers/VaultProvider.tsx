"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

interface VaultContextType {
  vaultKey: CryptoKey | null;
  setVaultKey: (key: CryptoKey | null) => void;
  isUnlocked: boolean;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const isUnlocked = !!vaultKey;

  useEffect(() => {
    // Protected routes that require vault unlock
    const protectedRoutes = ["/dashboard", "/passwords"];
    const isProtected = protectedRoutes.some(route => pathname.startsWith(route));

    if (isProtected && !isUnlocked) {
      // Redirect to unlock page
      router.replace("/unlock");
    }
  }, [isUnlocked, pathname, router]);

  // Inactivity timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      if (isUnlocked) {
        timer = setTimeout(() => {
          setVaultKey(null);
          // The other useEffect will handle the redirect if we are on a protected route
        }, 5 * 60 * 1000); // 5 minutes
      }
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    
    if (isUnlocked) {
      resetTimer();
      events.forEach(event => window.addEventListener(event, resetTimer));
    }

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isUnlocked, setVaultKey]);

  return (
    <VaultContext.Provider value={{ vaultKey, setVaultKey, isUnlocked }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return context;
}
