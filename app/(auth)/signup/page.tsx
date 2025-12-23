"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateVaultKey, deriveKeyFromPasswordScrypt, encryptVaultKey, arrayBufferToBase64, generateKdfParamsScrypt } from "@/lib/crypto";

// Match Zod schemas from @/schemas/auth
function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: string) {
  return password.length >= 8 && password.length <= 128;
}

function passwordStrength(pw: string) {
  if (pw.length >= 12) return "strong";
  if (pw.length >= 8) return "medium";
  if (pw.length > 0) return "weak";
  return "";
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmMasterPassword, setConfirmMasterPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [showConfirmMasterPassword, setShowConfirmMasterPassword] = useState(false);
  
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [masterPasswordError, setMasterPasswordError] = useState<string | null>(null);
  const [confirmMasterPasswordError, setConfirmMasterPasswordError] = useState<string | null>(null);
  
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Verification modal state
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  
  // Rate limiting state
  const [resendAttempts, setResendAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  function validate() {
    let ok = true;
    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address");
      ok = false;
    } else {
      setEmailError(null);
    }

    if (!isValidPassword(password)) {
      setPasswordError("Password must be 8-128 characters");
      ok = false;
    } else {
      setPasswordError(null);
    }

    if (password !== confirm) {
      setConfirmError("Passwords do not match");
      ok = false;
    } else {
      setConfirmError(null);
    }

    if (!isValidPassword(masterPassword)) {
      setMasterPasswordError("Master Password must be 8-128 characters");
      ok = false;
    } else {
      setMasterPasswordError(null);
    }

    if (masterPassword !== confirmMasterPassword) {
      setConfirmMasterPasswordError("Master Passwords do not match");
      ok = false;
    } else {
      setConfirmMasterPasswordError(null);
    }

    return ok;
  }

  const router = useRouter();

  // Load rate limiting data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`resend_lock_${email}`);
    if (stored) {
      const data = JSON.parse(stored);
      const now = Date.now();
      
      if (data.lockUntil > now) {
        setLockUntil(data.lockUntil);
        setResendAttempts(data.attempts || 0);
      } else if (data.lockUntil && now - data.lockUntil > 24 * 60 * 60 * 1000) {
        // Reset after 24 hours past lock expiry
        localStorage.removeItem(`resend_lock_${email}`);
        setResendAttempts(0);
        setLockUntil(null);
      } else {
        setResendAttempts(data.attempts || 0);
      }
    }
  }, [email]);

  // Countdown timer
  useEffect(() => {
    if (!lockUntil) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setCountdown(remaining);
      
      if (remaining === 0) {
        setLockUntil(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  function formatCountdown(seconds: number): string {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    } else if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    }
    return `${seconds}s`;
  }

  async function handleResendVerification() {
    // Check if locked (already at max attempts or time-locked)
    if (resendAttempts >= 3 || (lockUntil && lockUntil > Date.now())) {
      return;
    }

    setIsResending(true);
    setResendMessage(null);
    
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      
      if (res.ok) {
        setResendMessage('Verification email sent! Please check your inbox.');
        
        // Calculate new lock time with progressive delays: 30s, 60s, 120s
        const newAttempts = resendAttempts + 1;
        const lockDuration = 30000 * Math.pow(2, newAttempts - 1);
        
        const newLockUntil = Date.now() + lockDuration;
        setLockUntil(newLockUntil);
        setResendAttempts(newAttempts);
        
        // Save to localStorage
        localStorage.setItem(`resend_lock_${email}`, JSON.stringify({
          attempts: newAttempts,
          lockUntil: newLockUntil,
        }));
      } else if (res.status === 429) {
        // Backend rate limit reached (all 3 attempts used)
        setResendMessage('Too many resend attempts. You can try again in 1 hour.');
        setResendAttempts(3); // Mark as maxed out
        localStorage.setItem(`resend_lock_${email}`, JSON.stringify({
          attempts: 3,
          lockUntil: Date.now() + 1000, // Lock immediately
        }));
      } else {
        setResendMessage(data?.error || 'Failed to resend email. Please try again.');
      }
    } catch {
      setResendMessage('Failed to resend email. Please try again.');
    } finally {
      setIsResending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Generate Salt (16 bytes random)
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = arrayBufferToBase64(salt.buffer);

      // Generate Vault Key (random 256-bit AES key)
      const vaultKey = await generateVaultKey();

      // Derive KEK using scrypt (current default, memory-hard ~64 MiB)
      const kek = await deriveKeyFromPasswordScrypt(masterPassword, salt);

      // Encrypt Vault Key with KEK
      const encryptedVaultKey = await encryptVaultKey(vaultKey, kek);

      // Generate KDF parameters (includes version identifier for backward compatibility)
      const kdfParams = generateKdfParamsScrypt();

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          encryptedVaultKey, 
          salt: saltBase64, 
          kdfParams 
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setGeneralError(data?.error || 'Unable to create account');
        return;
      }

      // On success, show verification modal instead of redirecting
      setShowVerificationModal(true);
    } catch (err) {
      console.error(err);
      setGeneralError('Unable to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const strength = passwordStrength(password);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#2b2d42] text-white">
      {/* Back to home link */}
      <Link 
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-white/60 transition-opacity hover:opacity-80"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to home
      </Link>
      
      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/70">
          <div 
            className="rounded-xl p-8 max-w-md w-full bg-black/30 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          >
            <div className="text-center">
              <div 
                className="mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-4 bg-[#8d99ae]/20"
              >
                <svg className="h-7 w-7 text-[#8d99ae]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">
                Verify Your Email
              </h3>
              <p className="text-sm mb-4 text-white/75">
                We&apos;ve sent a verification link to <strong className="text-[#8d99ae]">{email}</strong>. Please check your inbox and click the link to verify your account.
              </p>
              
              {resendMessage && (
                <div className="mb-4 p-3 rounded-lg bg-[#8d99ae]/15">
                  <p className="text-sm text-[#8d99ae]">{resendMessage}</p>
                </div>
              )}
              
              <div className="space-y-3">
                <button
                  onClick={handleResendVerification}
                  disabled={isResending || countdown > 0}
                  className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${isResending || countdown > 0 ? 'bg-[#8d99ae]/30 text-white/50 cursor-not-allowed opacity-60' : 'bg-[#8d99ae] text-[#2b2d42] hover:shadow-lg'}`}
                >
                  {isResending 
                    ? 'Sending...' 
                    : countdown > 0 
                      ? `Wait ${formatCountdown(countdown)}` 
                      : 'Resend Verification Email'
                  }
                </button>
                
                <button
                  onClick={() => router.push('/login')}
                  className="w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-90 bg-[#8d99ae]/20 border border-[#8d99ae]/30 text-[#8d99ae]"
                >
                  Go to Login
                </button>
              </div>
              
              <p className="text-xs mt-4 text-white/50">
                Can&apos;t find the email? Check your spam folder or click resend.
              </p>
            </div>
          </div>
        </div>
      )}

      <div 
        className="w-full max-w-[480px] rounded-xl p-8 bg-black/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white">
            Create your account
          </h1>
          <p className="text-sm text-white/70">
            Start securing your passwords with enterprise-grade encryption
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <label className="block">
            <span className="text-sm font-medium mb-2 block text-white/85">
              Email
            </span>
            <input
              id="signup-email"
              type="email"
              required
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "signup-email-error" : undefined}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              className={`w-full px-4 py-3 rounded-lg text-sm transition-all duration-200 outline-none bg-black/30 text-white border ${emailError ? 'border-[#8d99ae]/60' : 'border-[#8d99ae]/20'} focus:border-[#8d99ae]/60 focus:ring-2 focus:ring-[#8d99ae]/20`}
              placeholder="your@email.com"
            />
            {emailError && (
              <p id="signup-email-error" className="mt-2 text-xs text-[#8d99ae] opacity-90">
                {emailError}
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium mb-2 block text-white/85">
              Login Password
            </span>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                required
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "signup-password-error" : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                className={`w-full px-4 py-3 pr-12 rounded-lg text-sm transition-all duration-200 outline-none bg-black/30 text-white border ${passwordError ? 'border-[#8d99ae]/60' : 'border-[#8d99ae]/20'} focus:border-[#8d99ae]/60 focus:ring-2 focus:ring-[#8d99ae]/20`}
                placeholder="Create a strong password"
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
            {passwordError && (
              <p id="signup-password-error" className="mt-2 text-xs text-[#8d99ae] opacity-90">
                {passwordError}
              </p>
            )}

            {strength && (
              <p className="mt-2 text-xs text-white/70">
                <span className="font-medium">Strength:</span>{' '}
                <span className={`${strength === 'strong' ? 'text-[#8d99ae] opacity-100' : strength === 'medium' ? 'text-[#8d99ae] opacity-70' : 'text-[#8d99ae] opacity-50'}`}>{strength}</span>
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium mb-2 block text-white/85">
              Confirm Login Password
            </span>
            <div className="relative">
              <input
                id="signup-confirm"
                type={showConfirm ? "text" : "password"}
                required
                aria-invalid={!!confirmError}
                aria-describedby={confirmError ? "signup-confirm-error" : undefined}
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (confirmError) setConfirmError(null);
                }}
                className={`w-full px-4 py-3 pr-12 rounded-lg text-sm transition-all duration-200 outline-none bg-black/30 text-white border ${confirmError ? 'border-[#8d99ae]/60' : 'border-[#8d99ae]/20'} focus:border-[#8d99ae]/60 focus:ring-2 focus:ring-[#8d99ae]/20`}
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8d99ae] opacity-60 transition-opacity hover:opacity-100"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? (
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
            {confirmError && (
              <p id="signup-confirm-error" className="mt-2 text-xs text-[#8d99ae] opacity-90">
                {confirmError}
              </p>
            )}
          </label>

          <div className="pt-4 mt-4 border-t border-white/10">
            <h3 className="text-lg font-bold mb-2 text-white">Security Setup</h3>
            <p className="text-xs mb-4 text-white/65">
              Create a Master Password to encrypt your vault. This password is <strong>NEVER</strong> sent to our servers and cannot be recovered if lost.
            </p>

            <label className="block mb-5">
              <span className="text-sm font-medium mb-2 block text-white/85">
                Master Password
              </span>
              <div className="relative">
                <input
                  id="signup-master-password"
                  type={showMasterPassword ? "text" : "password"}
                  required
                  aria-invalid={!!masterPasswordError}
                  aria-describedby={masterPasswordError ? "signup-master-password-error" : undefined}
                  value={masterPassword}
                  onChange={(e) => {
                    setMasterPassword(e.target.value);
                    if (masterPasswordError) setMasterPasswordError(null);
                  }}
                  className={`w-full px-4 py-3 pr-12 rounded-lg text-sm transition-all duration-200 outline-none bg-black/30 text-white border ${masterPasswordError ? 'border-[#8d99ae]/60' : 'border-[#8d99ae]/20'} focus:border-[#8d99ae]/60 focus:ring-2 focus:ring-[#8d99ae]/20`}
                  placeholder="Create master password"
                />
                <button
                  type="button"
                  onClick={() => setShowMasterPassword(!showMasterPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8d99ae] opacity-60 transition-opacity hover:opacity-100"
                  aria-label={showMasterPassword ? "Hide password" : "Show password"}
                >
                  {showMasterPassword ? (
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
              {masterPasswordError && (
                <p id="signup-master-password-error" className="mt-2 text-xs text-[#8d99ae] opacity-90">
                  {masterPasswordError}
                </p>
              )}
            </label>

            <label className="block">
              <span className="text-sm font-medium mb-2 block text-white/85">
                Confirm Master Password
              </span>
              <div className="relative">
                <input
                  id="signup-confirm-master"
                  type={showConfirmMasterPassword ? "text" : "password"}
                  required
                  aria-invalid={!!confirmMasterPasswordError}
                  aria-describedby={confirmMasterPasswordError ? "signup-confirm-master-error" : undefined}
                  value={confirmMasterPassword}
                  onChange={(e) => {
                    setConfirmMasterPassword(e.target.value);
                    if (confirmMasterPasswordError) setConfirmMasterPasswordError(null);
                  }}
                  className={`w-full px-4 py-3 pr-12 rounded-lg text-sm transition-all duration-200 outline-none bg-black/30 text-white border ${confirmMasterPasswordError ? 'border-[#8d99ae]/60' : 'border-[#8d99ae]/20'} focus:border-[#8d99ae]/60 focus:ring-2 focus:ring-[#8d99ae]/20`}
                  placeholder="Confirm master password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmMasterPassword(!showConfirmMasterPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8d99ae] opacity-60 transition-opacity hover:opacity-100"
                  aria-label={showConfirmMasterPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmMasterPassword ? (
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
              {confirmMasterPasswordError && (
                <p id="signup-confirm-master-error" className="mt-2 text-xs text-[#8d99ae] opacity-90">
                  {confirmMasterPasswordError}
                </p>
              )}
            </label>
          </div>

          {generalError && (
            <div className="p-3 rounded-lg bg-[#8d99ae]/15">
              <p className="text-sm text-[#8d99ae]">{generalError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${isSubmitting ? 'bg-[#8d99ae]/50 text-[#2b2d42] cursor-not-allowed opacity-70' : 'bg-[#8d99ae] text-[#2b2d42] hover:shadow-lg'}`}
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-center mt-6 text-white/60">
          Already have an account?{' '}
          <Link 
            href="/login" 
            className="font-medium text-[#8d99ae] transition-opacity hover:opacity-80"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
