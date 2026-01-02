"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

interface VaultContextType {
  vaultKey: CryptoKey | null;
  setVaultKey: (key: CryptoKey | null) => void;
  isUnlocked: boolean;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

// Vault timeout constants (configurable via env, default: 5 min inactivity, 60 min absolute)
const VAULT_INACTIVITY_TIMEOUT_MS = 
  (typeof window !== 'undefined' ? 
    parseInt(process.env.NEXT_PUBLIC_VAULT_INACTIVITY_MS || '300000', 10) :
    5 * 60 * 1000) // 5 minutes default

const VAULT_ABSOLUTE_TIMEOUT_MS =
  (typeof window !== 'undefined' ?
    parseInt(process.env.NEXT_PUBLIC_VAULT_ABSOLUTE_MS || '3600000', 10) :
    60 * 60 * 1000) // 60 minutes default

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultKeyState, setVaultKeyState] = useState<CryptoKey | null>(null);
  const [vaultUnlockedAt, setVaultUnlockedAt] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const setVaultKey = (key: CryptoKey | null) => {
    setVaultKeyState(key);
    if (key) {
      setVaultUnlockedAt(Date.now());
    } else {
      setVaultUnlockedAt(null);
    }
  };

  const vaultKey = vaultKeyState;
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

  // Inactivity timer + absolute timeout + visibility listener
  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout | null = null;
    let absoluteTimer: NodeJS.Timeout | null = null;
    
    const lockVault = () => {
      setVaultKey(null);
      setVaultUnlockedAt(null);
      // The other useEffect will handle the redirect if we are on a protected route
    };

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (isUnlocked) {
        inactivityTimer = setTimeout(() => {
          lockVault();
        }, VAULT_INACTIVITY_TIMEOUT_MS);
      }
    };

    const handleVisibilityChange = () => {
      // Lock vault immediately when tab becomes hidden
      if (document.hidden) {
        lockVault();
      }
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    
    if (isUnlocked) {
      resetInactivityTimer();
      events.forEach(event => window.addEventListener(event, resetInactivityTimer));
      
      // Listen for tab visibility change
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Set up absolute timeout (lock after N minutes regardless of activity)
      if (absoluteTimer) clearTimeout(absoluteTimer);
      absoluteTimer = setTimeout(() => {
        lockVault();
      }, VAULT_ABSOLUTE_TIMEOUT_MS);
    }

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (absoluteTimer) clearTimeout(absoluteTimer);
      events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isUnlocked, vaultUnlockedAt]);

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
