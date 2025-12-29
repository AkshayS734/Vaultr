"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/app/components/providers/VaultProvider";
import { deriveKeyFromPasswordAuto, decryptVaultKey } from "@/app/lib/crypto";

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
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      router.push('/login');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#2b2d42] text-white">
      {/* Header with app name and logout */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
        <div className="text-xl font-bold text-white">
          Vaultr
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-white/50 transition-opacity hover:opacity-80"
        >
          Logout
        </button>
      </div>

      {/* Unlock Card */}
      <div 
        className="w-full max-w-[440px] rounded-xl p-8 bg-[#2b2d42] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        <div className="text-center mb-8">
          <div 
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-[#8d99ae]/15"
          >
            <svg 
              className="w-8 h-8 text-[#8d99ae]" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold mb-3 text-white">
            Unlock your vault
          </h1>
          <p className="text-sm text-white/75">
            Enter your master password to access your secrets
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-6">
          <div>
            <label className="block">
              <span className="text-sm font-medium mb-2 block text-white/85">
                Master Password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-lg text-sm transition-all duration-200 outline-none bg-black/30 text-white border border-[#8d99ae]/20 focus:border-[#8d99ae]/60 focus:ring-2 focus:ring-[#8d99ae]/20"
                  placeholder="Enter your master password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8d99ae] opacity-60 transition-opacity hover:opacity-100"
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
            </label>
            
            <p className="mt-2 text-xs flex items-center gap-1.5 text-white/50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Your master password never leaves this device
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#8d99ae]/15">
              <p className="text-sm text-[#8d99ae]">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${isLoading ? 'bg-[#8d99ae]/50 text-[#2b2d42] cursor-not-allowed opacity-70' : 'bg-[#8d99ae] text-[#2b2d42] hover:shadow-lg'}`}
          >
            {isLoading ? "Unlocking..." : "Unlock Vault"}
          </button>
        </form>
      </div>
    </div>
  );
}
