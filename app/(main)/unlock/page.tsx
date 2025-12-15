"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/components/VaultProvider";
import { deriveKeyFromPassword, base64ToArrayBuffer } from "@/lib/crypto";

export default function UnlockPage() {
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { setVaultKey, isUnlocked } = useVault();
  const router = useRouter();

  useEffect(() => {
    if (isUnlocked) {
      router.replace("/dashboard");
    }
  }, [isUnlocked, router]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // 1. Fetch encrypted vault key and salt from backend
      const res = await fetch("/api/vault/keys");
      if (!res.ok) {
        if (res.status === 401) {
            router.push('/login');
            return;
        }
        throw new Error("Failed to fetch vault keys");
      }
      const data = await res.json();
      const { encryptedVaultKey, salt, kdfParams } = data;

      // 2. Derive KEK
      const saltBuffer = base64ToArrayBuffer(salt);
      const kek = await deriveKeyFromPassword(masterPassword, new Uint8Array(saltBuffer));

      // 3. Decrypt Vault Key
      const encryptedBuffer = base64ToArrayBuffer(encryptedVaultKey);
      const iv = new Uint8Array(encryptedBuffer.slice(0, 12));
      const dataBuffer = new Uint8Array(encryptedBuffer.slice(12));

      const vaultKey = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        kek,
        dataBuffer
      );

      // 4. Import Vault Key
      const importedVaultKey = await window.crypto.subtle.importKey(
        "raw",
        vaultKey,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
      );

      setVaultKey(importedVaultKey);
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Invalid Master Password or server error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Unlock your passwords</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter your Master Password to decrypt your vault.</p>

        <form onSubmit={handleUnlock} className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-700 dark:text-gray-300">Master Password</span>
            <input
              type="password"
              required
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Unlocking..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
