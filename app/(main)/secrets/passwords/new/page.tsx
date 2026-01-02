"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/app/components/providers/VaultProvider";
import { encryptItem } from "@/app/lib/crypto";
import { generatePassword } from "@/app/lib/password-generator";
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
  const [health, setHealth] = useState<PasswordHealthResult | null>(null);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [breachCheckEnabled, setBreachCheckEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  // Check for password health as user types (in-memory only)
  useEffect(() => {
    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    async function checkHealth() {
      if (!password) {
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
        // Evaluate full health including client-side reuse detection
        const result = await evaluatePasswordHealth(password, {
          vaultKey: vaultKey ?? undefined,
          existingItems: vaultItems,
          enableBreachCheck: breachCheckEnabled,
          breachChecker,
        });
        if (!cancelled) {
          setHealth(result);
        }
      } catch {
        // Silent fail - do not leak password or results
        if (!cancelled) {
          setHealth(null);
        }
      }
    }

    // Debounce only applies to the entire check (network breach check is inside)
    // Local checks (strength, reuse) run within the debounced call
    timeoutId = setTimeout(() => {
      checkHealth();
    }, 400);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [password, vaultKey, vaultItems, breachCheckEnabled]);

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
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <nav className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border hover:bg-muted transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Add Password</h1>
          <p className="text-muted-foreground">Store a new credential in your vault</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Credential Details Card */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Credential Details</h2>
            
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., GitHub, Gmail, Work Email"
                />
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://example.com"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Username / Email</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="username or email@example.com"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 pr-20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    placeholder="Enter or generate a password"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newPassword = generatePassword({ length: 16 })
                      setPassword(newPassword)
                      setShowPassword(true)
                    }}
                    className="absolute right-11 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    title="Generate password"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 22l-.394-1.433a2.25 2.25 0 00-1.423-1.423L13.25 19l1.433-.394a2.25 2.25 0 001.423-1.423L16.5 15.75l.394 1.433a2.25 2.25 0 001.423 1.423L19.75 19l-1.433.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Password Health Display Card */}
          {password && health && (
                  <div className="bg-muted/30 rounded-lg border border-border p-5 space-y-4 mt-3">
                    <div className="space-y-3">
                      {/* Strength Meter Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Strength</span>
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
                          <div className="flex-1 h-2 bg-background rounded-full overflow-hidden border border-border">
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
                        <div className="pt-1 space-y-1 text-xs text-warning">
                          {health.warnings.map((w, i) => (
                            <div key={i} className="flex gap-2">
                              <span className="text-muted-foreground flex-shrink-0">•</span>
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Optional Breach Detection Section */}
                    <div className="pt-2 border-t border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <label htmlFor="breach-check" className="block text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer">
                            Breach Detection <span className="text-muted-foreground/60">(optional)</span>
                          </label>
                          <p className="text-xs text-muted-foreground/70">Check if this password appeared in known data breaches</p>
                        </div>
                        <input
                          id="breach-check"
                          type="checkbox"
                          className="h-5 w-5 rounded border-border bg-background accent-primary cursor-pointer"
                          checked={breachCheckEnabled}
                          onChange={(e) => setBreachCheckEnabled(e.target.checked)}
                        />
                      </div>

                      {/* Breach Status Message - Only shown when breach check enabled */}
                      {breachCheckEnabled && health && password && (
                        <div className={`flex items-center gap-2 p-3 rounded-md text-xs ${
                          health.flags.breached
                            ? 'bg-red-500/10 border border-red-600/40 text-red-300'
                            : 'bg-green-500/10 border border-green-600/40 text-green-300'
                        }`}>
                          <span className="text-lg flex-shrink-0">
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
                        <div className="text-xs text-muted-foreground/50 italic">
                          Enable above to check if this password has appeared in known data breaches.
                        </div>
                      )}
                    </div>
                  </div>
                )}

          {/* Notes */}
          <div className="bg-card rounded-lg shadow-lg border border-border">
            <div className="border-b border-border p-4">
              <h3 className="text-lg font-semibold text-foreground">Notes (Optional)</h3>
            </div>
            <div className="p-4">
              <textarea
                id="notes"
                placeholder="Add any additional notes about this credential..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:ring-primary text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>
          </div>

          {/* Security Warning */}
          {password && password.length < 12 && (
            <div className="flex items-start gap-3 rounded-lg bg-warning/10 border border-warning/20 p-4">
              <svg className="h-5 w-5 flex-shrink-0 text-warning mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p className="font-medium text-warning">Weak Password Detected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Consider using a longer password (12+ characters) with a mix of
                  letters, numbers, and symbols.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Saving..." : "Save Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
