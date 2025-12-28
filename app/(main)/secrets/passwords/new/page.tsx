"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/app/components/providers/VaultProvider";
import { encryptItem } from "@/app/lib/crypto";
import { 
  SecretType, 
  buildEncryptedPayload, 
  buildMetadata,
  validatePasswordInput,
  type PasswordInput 
} from "@/app/lib/secret-utils";
import { 
  checkVaultPasswordReuse,
  formatReuseWarning,
  type VaultPasswordReuseResult 
} from "@/app/lib/vault-password-reuse";

interface VaultItem {
  id: string
  encryptedData: string
  iv: string
  secretType: string
  metadata?: {
    title?: string
  }
}

export default function NewPasswordPage() {
  const router = useRouter();
  const { vaultKey, isUnlocked } = useVault();
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reuseResult, setReuseResult] = useState<VaultPasswordReuseResult | null>(null);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);

  async function handleLogout() {
    try {
      await fetch("/logout", { method: "POST" });
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
  }

  // Fetch existing vault items on mount to enable reuse detection
  useEffect(() => {
    async function fetchVaultItems() {
      try {
        const res = await fetch("/api/passwords");
        if (res.ok) {
          const items = await res.json();
          setVaultItems(items);
        }
      } catch (err) {
        // Silent fail - reuse detection is optional enhancement
        console.error("Failed to fetch vault items for reuse detection", err);
      }
    }

    if (isUnlocked && vaultKey) {
      fetchVaultItems();
    }
  }, [isUnlocked, vaultKey]);

  // Check for password reuse as user types
  useEffect(() => {
    async function checkReuse() {
      if (!password || password.length < 3 || !vaultKey) {
        setReuseResult(null);
        return;
      }

      try {
        const result = await checkVaultPasswordReuse(
          password,
          vaultKey,
          vaultItems
        );
        setReuseResult(result.matches > 0 ? result : null);
      } catch (err) {
        // Silent fail - reuse detection is optional enhancement
        console.error("Reuse check failed", err);
        setReuseResult(null);
      }
    }

    checkReuse();
  }, [password, vaultKey, vaultItems]);

  if (!isUnlocked) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!vaultKey) throw new Error("Vault is locked");

      // 1. Build password input
      const passwordInput: PasswordInput = {
        title,
        username,
        password,
        website,
        notes,
      };

      // 2. Validate input
      validatePasswordInput(passwordInput);

      // 3. Build encrypted payload (ALL sensitive data)
      const encryptedPayload = buildEncryptedPayload(SecretType.PASSWORD, passwordInput);

      // 4. Build metadata (ONLY non-sensitive data)
      const metadata = buildMetadata(SecretType.PASSWORD, passwordInput);

      // 5. Encrypt the payload
      const { encryptedData, iv: ivBase64 } = await encryptItem(
        encryptedPayload,
        vaultKey
      );

      // 6. Send to backend with metadata and secretType
      const res = await fetch("/api/passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedData,
          iv: ivBase64,
          metadata,
          secretType: SecretType.PASSWORD,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save password");
      }

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#2b2d42]">
      {/* Top Navigation Bar */}
      <nav className="border-b border-[rgba(141,153,174,0.1)] bg-[rgba(0,0,0,0.2)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-300 items-center justify-between px-6">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-[#8d99ae] hover:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="rounded-md border border-[rgba(141,153,174,0.3)] px-4 py-2 text-sm font-medium text-[rgba(141,153,174,0.8)] transition-all duration-200 hover:bg-[rgba(141,153,174,0.1)] hover:text-[#8d99ae] focus:outline-none focus:ring-2 focus:ring-[rgba(141,153,174,0.4)]"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="bg-black/20 rounded-lg shadow-lg p-6 border border-[#8d99ae]/20">
        <h1 className="text-2xl font-bold text-white mb-6">Add New Password</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/85">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 text-white"
              placeholder="e.g. Google, Netflix"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85">Username / Email</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 text-white"
            />
            {reuseResult && (
              <div className="mt-2 p-3 rounded-md bg-yellow-900/30 border border-yellow-600/50 text-yellow-200 text-sm">
                <div className="flex gap-2">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <p className="font-medium">Password already in use</p>
                    <p className="text-yellow-300/80 text-xs mt-1">
                      {formatReuseWarning(reuseResult)}
                    </p>
                    <p className="text-yellow-300/70 text-xs mt-2 italic">
                      You can still save this password if intended.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85">Website URL</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 text-white"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-[#2b2d42] bg-[#8d99ae] border border-[#8d99ae] rounded-md hover:bg-[#8d99ae]/90"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-[#2b2d42] bg-[#8d99ae] rounded-md hover:bg-[#8d99ae]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Save Password"}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
