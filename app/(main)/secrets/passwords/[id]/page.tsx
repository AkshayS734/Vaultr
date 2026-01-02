"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/app/components/providers/VaultProvider";
import { encryptItem, decryptItem } from "@/app/lib/crypto";
import { 
  SecretType, 
  buildEncryptedPayload, 
  buildMetadata,
  validatePasswordInput,
  type PasswordInput
} from "@/app/lib/secret-utils";
// Reuse detection is handled via PasswordHealthEngine flags; no direct calls here.
import { evaluatePasswordHealth, type PasswordHealthResult } from "@/app/lib/password-health-engine";
import { makeBreachChecker } from "@/app/lib/password-breach";

interface VaultItem {
  id: string
  encryptedData: string
  iv: string
  secretType: string
  metadata?: {
    title?: string
  }
}

export default function PasswordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { vaultKey, isUnlocked } = useVault();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<PasswordHealthResult | null>(null);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [lastChangedAt, setLastChangedAt] = useState<number | undefined>(undefined);
  const [breachCheckEnabled, setBreachCheckEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  
  // Unwrap params
  const { id } = use(params);

  useEffect(() => {
    if (!isUnlocked) return;

    async function fetchItem() {
      try {
        const res = await fetch(`/api/passwords/${id}`);
        if (!res.ok) throw new Error("Failed to fetch password");
        
        const item = await res.json();
        
        // Validate required fields
        if (!item.encryptedData || !item.iv) {
          throw new Error("Missing encrypted data");
        }
        
        // Decrypt using centralized function with correct parameters
        const data = await decryptItem<Record<string, unknown>>(item.encryptedData, item.iv, vaultKey!);

        setTitle(typeof data.title === 'string' ? data.title : "");
        setUsername(typeof data.username === 'string' ? data.username : "");
        setPassword(typeof data.password === 'string' ? data.password : "");
        setWebsite(typeof data.website === 'string' ? data.website : "");
        setNotes(typeof data.notes === 'string' ? data.notes : "");
        if (item?.updatedAt) {
          const ts = new Date(item.updatedAt).getTime();
          if (!Number.isNaN(ts)) setLastChangedAt(ts);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load password details");
      } finally {
        setLoading(false);
      }
    }

    // Also fetch other vault items for reuse detection
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

    fetchItem();
    if (vaultKey) {
      fetchVaultItems();
    }
  }, [id, isUnlocked, vaultKey]);

  // Check for password health as user edits (excluding current item)
  useEffect(() => {
    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    async function checkHealth() {
      if (!password || !vaultKey || !isEditing) {
        if (!cancelled) {
          setHealth(null);
        }
        return;
      }

      try {
        let breachChecker: ((password: string) => Promise<boolean>) | undefined = undefined;
        // Enforce client calls our own proxy only (no third-party direct calls)
        if (breachCheckEnabled) {
          breachChecker = makeBreachChecker('/api/breach');
        }
        const result = await evaluatePasswordHealth(password, {
          vaultKey,
          existingItems: vaultItems,
          excludeId: id,
          lastChangedAt,
          enableBreachCheck: breachCheckEnabled,
          breachChecker,
        });
        if (!cancelled) {
          setHealth(result);
        }
      } catch {
        if (!cancelled) {
          setHealth(null);
        }
      }
    }

    // Debounce the entire health check (network breach check is inside)
    timeoutId = setTimeout(() => {
      checkHealth();
    }, 400);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [password, vaultKey, vaultItems, isEditing, id, lastChangedAt, breachCheckEnabled]);

  if (!isUnlocked) return null;
  if (loading) return <div className="p-8 text-center">Loading...</div>;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!vaultKey) throw new Error("Vault is locked");

      // Build password input
      const passwordInput: PasswordInput = {
        title,
        username,
        password,
        website,
        notes,
      };

      // Validate input
      validatePasswordInput(passwordInput);

      // Build encrypted payload (ALL sensitive data)
      const encryptedPayload = buildEncryptedPayload(SecretType.PASSWORD, passwordInput);

      // Build metadata (ONLY non-sensitive data)
      const metadata = buildMetadata(SecretType.PASSWORD, passwordInput);

      // Encrypt the payload
      const { encryptedData, iv: ivBase64 } = await encryptItem(
        encryptedPayload,
        vaultKey
      );

      const res = await fetch(`/api/passwords/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedData,
          iv: ivBase64,
          metadata,
          secretType: SecretType.PASSWORD,
        }),
      });

      if (!res.ok) throw new Error("Failed to update password");

      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError("Failed to update password");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this password?")) return;
    
    try {
      const res = await fetch(`/api/passwords/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Failed to delete password");
    }
  }

  async function handleLogout() {
    try {
      await fetch("/logout", { method: "POST" });
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">
            {isEditing ? "Edit Password" : title}
          </h1>
          {!isEditing && (
            <div className="space-x-2">
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-md border border-[rgba(141,153,174,0.3)] px-3 py-1 text-sm font-medium text-[rgba(141,153,174,0.8)] transition-all duration-200 hover:bg-[rgba(141,153,174,0.1)] hover:text-[#8d99ae] focus:outline-none focus:ring-2 focus:ring-[rgba(141,153,174,0.4)]"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md border border-[rgba(220,53,69,0.3)] px-3 py-1 text-sm font-medium text-[rgba(220,53,69,0.8)] transition-all duration-200 hover:bg-[rgba(220,53,69,0.1)] hover:text-[#dc3545] focus:outline-none focus:ring-2 focus:ring-[rgba(220,53,69,0.4)]"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/85">Title</label>
            <input
              type="text"
              required
              disabled={!isEditing}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85">Username</label>
            <div className="flex">
              <input
                type="text"
                disabled={!isEditing}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white"
              />
              {!isEditing && username && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(username)}
                  className="ml-2 px-3 py-2 text-sm text-[#8d99ae]/70 hover:text-[#8d99ae]"
                >
                  Copy
                </button>
              )}
            </div>
          </div>

          <div>
            {!isEditing ? (
              <>
                <label className="block text-sm font-medium text-white/85">Password</label>
                <div className="flex">
                  <input
                    type="password"
                    required
                    disabled={true}
                    value={password}
                    className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white"
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(password)}
                    className="ml-2 px-3 py-2 text-sm text-[#8d99ae]/70 hover:text-[#8d99ae]"
                  >
                    Copy
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Password Input Field (Edit Mode) */}
                <div>
                  <label className="block text-sm font-medium text-white/85 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2.5 pr-10 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 text-white text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8d99ae]/70 hover:text-[#8d99ae] transition-colors"
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Health Display Card (Edit Mode) */}
                {password && health && (
                <div className="bg-[#1f2233]/50 rounded-lg border border-[#8d99ae]/20 p-5 space-y-4">
                  <div className="space-y-3">
                      {/* Strength Meter Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Strength</span>
                          <span className={`text-sm font-semibold ${
                            health.score >= 90 ? 'text-green-400' :
                            health.score >= 70 ? 'text-green-400' :
                            health.score >= 50 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {health.score >= 90 ? 'Excellent' :
                             health.score >= 70 ? 'Strong' :
                             health.score >= 50 ? 'Fair' : 'Weak'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[#2b2d42] rounded-full overflow-hidden border border-[#8d99ae]/10">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                health.score >= 90 ? 'bg-green-500/90' :
                                health.score >= 70 ? 'bg-green-500/90' :
                                health.score >= 50 ? 'bg-yellow-500/90' :
                                'bg-red-500/90'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, health.score))}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-white/60 w-10 text-right">{health.score}/100</span>
                        </div>
                      </div>

                      {/* Risk Indicators Section */}
                      <div className="space-y-2 pt-1">
                        {/* Reuse Warning - Always visible if detected */}
                        {health.flags.reused && (
                          <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/5 border border-yellow-600/40 text-yellow-300 text-xs">
                            <span className="text-lg mt-0.5 flex-shrink-0">⚠️</span>
                            <span className="flex-1">This password is already used in other items. Consider a unique password.</span>
                          </div>
                        )}

                        {/* Other Flags - Age and Weak */}
                        {(health.flags.old || health.flags.weak) && (
                          <div className="flex flex-wrap gap-2">
                            {health.flags.weak && (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 border border-red-600/40 text-red-300 text-xs font-medium">
                                <span>●</span> Weak composition
                              </div>
                            )}
                            {health.flags.old && (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-500/10 border border-orange-600/40 text-orange-300 text-xs font-medium">
                                <span>●</span> Changed long ago
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Warnings List - If any */}
                      {health.warnings.length > 0 && (
                        <div className="pt-1 space-y-1 text-xs text-[#ffd6a0]">
                          {health.warnings.map((w, i) => (
                            <div key={i} className="flex gap-2">
                              <span className="text-[#8d99ae] flex-shrink-0">•</span>
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Optional Breach Detection Section */}
                  <div className="pt-2 border-t border-[#8d99ae]/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <label htmlFor="breach-check" className="block text-xs font-medium text-white/70 uppercase tracking-wide cursor-pointer">
                          Breach Detection <span className="text-[#8d99ae]/60">(optional)</span>
                        </label>
                        <p className="text-xs text-white/50">Check if this password appeared in known data breaches</p>
                      </div>
                      <input
                        id="breach-check"
                        type="checkbox"
                        className="h-5 w-5 rounded border-[#8d99ae]/30 bg-[#2b2d42] accent-[#8d99ae] cursor-pointer"
                        checked={breachCheckEnabled}
                        onChange={(e) => setBreachCheckEnabled(e.target.checked)}
                      />
                    </div>

                    {/* Breach Status Message - Only shown when breach check enabled */}
                    {breachCheckEnabled && health && password && (
                      <div className={`flex items-start gap-2 p-3 rounded-md text-xs ${
                        health.flags.breached
                          ? 'bg-red-500/10 border border-red-600/40 text-red-300'
                          : 'bg-green-500/10 border border-green-600/40 text-green-300'
                      }`}>
                        <span className="text-lg mt-0.5 flex-shrink-0">
                          {health.flags.breached ? '⚠️' : '✅'}
                        </span>
                        <span className="flex-1">
                          {health.flags.breached 
                            ? 'This password may have appeared in known data breaches. We recommend choosing a different password.'
                            : 'No known breaches found. This password has not appeared in known data breach databases.'}
                        </span>
                      </div>
                    )}

                    {/* Breach Disabled Hint - When toggle is OFF */}
                    {!breachCheckEnabled && health && password && (
                      <div className="text-xs text-white/40 italic">
                        Enable above to check if this password has appeared in known data breaches.
                      </div>
                    )}
                  </div>
                </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85">Website</label>
            <div className="flex">
              <input
                type="url"
                disabled={!isEditing}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white"
              />
              {!isEditing && website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 px-3 py-2 text-sm text-[#8d99ae] hover:underline flex items-center"
                >
                  Open
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85">Notes</label>
            <textarea
              disabled={!isEditing}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          {isEditing && (
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-[#2b2d42] bg-[#8d99ae] border border-[#8d99ae] rounded-md hover:bg-[#8d99ae]/90"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-[#2b2d42] bg-[#8d99ae] rounded-md hover:bg-[#8d99ae]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {!isEditing && (
            <></>
          )}
        </form>
      </div>
      </div>
    </div>
  );
}
