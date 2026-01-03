"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/app/components/providers/VaultProvider";
import { deriveKeyFromPasswordAuto, decryptVaultKey } from "@/app/lib/crypto";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { CircleAlert, Lock, ShieldCheck } from "lucide-react";

export default function UnlockPage() {
  const [masterPassword, setMasterPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

      // 2. Derive KEK using appropriate algorithm (auto-detects v1=PBKDF2 or v2=Argon2id)
      const kek = await deriveKeyFromPasswordAuto(masterPassword, salt, kdfParams);

      // 3. Decrypt Vault Key (simplified using new helper function)
      const vaultKey = await decryptVaultKey(encryptedVaultKey, kek);

      // 4. Store decrypted key in vault context
      setVaultKey(vaultKey);
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Unable to unlock vault. Please check your master password and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: "include", });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      router.push('/login');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo and Status */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10">
            <Lock className="h-8 w-8 text-warning" />
          </div>
          <h1 className="mb-2">Vault Locked</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Unlock Your Vault</CardTitle>
            <CardDescription>
              Enter your master password to decrypt and access your vault
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUnlock} className="space-y-4">
              {/* Master Password */}
              <div className="space-y-2">
                <Label htmlFor="master-password">Master Password</Label>
                <div className="relative">
                  <Input
                    id="master-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your master password"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This is the password that encrypts your vault data.
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" className="w-full cursor-pointer" size="lg" disabled={isLoading}>
                <ShieldCheck className="h-4 w-4" />
                {isLoading ? "Unlocking..." : "Unlock Vault"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Warning */}
        <div className="mt-6 rounded-lg bg-destructive/5 border border-destructive/20 p-4 text-center">
          <p className="text-xs text-destructive">
            <CircleAlert className="inline-block align-text-bottom mr-1 h-3 w-3" />
            Your Master Password cannot be reset or recovered. If you&apos;ve forgotten it,
            you will not be able to access your encrypted vault data.
          </p>
        </div>

        {/* Logout Link */}
        <div className="mt-4 text-center">
          <button
            onClick={handleLogout}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
