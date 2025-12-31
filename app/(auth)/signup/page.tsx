"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateVaultKey, deriveKeyFromPasswordScrypt, encryptVaultKey, arrayBufferToBase64, generateKdfParamsScrypt } from "@/app/lib/crypto";
import { generatePassword } from "@/app/lib/password-generator";
import { checkPasswordStrength, getStrengthLabel, getStrengthColor } from "@/app/lib/password-strength";
import { Button } from "@/components/vaultr-ui/button";
import { Input } from "@/components/vaultr-ui/input";
import { Label } from "@/components/vaultr-ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/vaultr-ui/card";
import { Separator } from "@/components/vaultr-ui/separator";
import { Checkbox } from "@/components/vaultr-ui/checkbox";
import { Lock, Mail, AlertCircle } from "lucide-react";

// Match Zod schemas from @/schemas/auth
function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: string) {
  return password.length >= 8 && password.length <= 128;
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
  const [passwordStrengthFeedback, setPasswordStrengthFeedback] = useState<string[]>([]);
  const [passwordScore, setPasswordScore] = useState(0);
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

  // Update password strength feedback in real-time
  useEffect(() => {
    if (!password) {
      setPasswordStrengthFeedback([]);
      setPasswordScore(0);
      return;
    }
    
    const result = checkPasswordStrength(password, { email });
    setPasswordScore(result.score);
    setPasswordStrengthFeedback(result.feedback);
  }, [password, email]);

  function handleGeneratePassword() {
    const generated = generatePassword({ length: 16, includeUpper: true, includeLower: true, includeNumbers: true, includeSymbols: true })
    setPassword(generated)
    setConfirm(generated)
    setPasswordError(null)
    setConfirmError(null)
  }

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
    } else if (passwordStrengthFeedback.length > 0) {
      setPasswordError("Password does not meet strength requirements");
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
      console.error('Signup error:', err);
      if (err instanceof Error) {
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
      }
      setGeneralError('Unable to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {/* Verification Modal */}
      {showVerificationModal && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="m-4 max-w-md w-full">
            <CardContent className="p-8">
            <div className="text-center">
              <div 
                className="mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-4 bg-primary/20"
              >
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">
                Verify Your Email
              </h3>
              <p className="text-sm mb-4 text-muted-foreground">
                We&apos;ve sent a verification link to <strong className="text-primary">{email}</strong>. Please check your inbox and click the link to verify your account.
              </p>
              
              {resendMessage && (
                <div className="mb-4 p-3 rounded-lg bg-primary/10">
                  <p className="text-sm text-primary">{resendMessage}</p>
                </div>
              )}
              
              <div className="space-y-3">
                <Button
                  onClick={handleResendVerification}
                  disabled={isResending || countdown > 0}
                  className="w-full"
                >
                  {isResending 
                    ? 'Sending...' 
                    : countdown > 0 
                      ? `Wait ${formatCountdown(countdown)}` 
                      : 'Resend Verification Email'
                  }
                </Button>
                
                <Button
                  onClick={() => router.push('/login')}
                  variant="outline"
                  className="w-full"
                >
                  Go to Login
                </Button>
              </div>
              
              <p className="text-xs mt-4 text-muted-foreground">
                Can&apos;t find the email? Check your spam folder or click resend.
              </p>
            </div>
            </CardContent>
          </div>
        </Card>
      )}

      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2">Create Your Vaultr Account</h1>
          <p className="text-muted-foreground">
            Secure password manager with zero-knowledge encryption
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>
              Set up your account with two different passwords
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    className="pl-10"
                    required
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? "signup-email-error" : undefined}
                  />
                </div>
                {emailError && (
                  <p id="signup-email-error" className="text-xs text-destructive">
                    {emailError}
                  </p>
                )}
              </div>

              <Separator />

              {/* Login Password Section */}
              <div className="space-y-4 rounded-lg bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Lock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-1">Login Password</h3>
                    <p className="text-sm text-muted-foreground">
                      Used only for account authentication. Can be reset via email.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signup-password">Login Password</Label>
                    <Button
                      type="button"
                      onClick={handleGeneratePassword}
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2 text-xs"
                    >
                      Generate
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
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
                      className="pr-12"
                      placeholder="Create a strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
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
                    <p id="signup-password-error" className="mt-2 text-xs text-destructive">
                      {passwordError}
                    </p>
                  )}

                  {password && (
                    <div className="mt-4 space-y-3 p-3 rounded-lg bg-muted/30 border border-border">
                      {/* Strength Indicator Bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-white/75">Strength</span>
                    <span className={`text-xs font-semibold ${passwordScore >= 3 ? 'text-green-400' : 'text-[#8d99ae]'}`}>
                      {getStrengthLabel(passwordScore)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getStrengthColor(passwordScore)}`}
                      style={{ width: `${Math.min(100, (passwordScore / 5) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Requirements Checklist */}
                {passwordStrengthFeedback.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-white/75">Unmet requirements:</p>
                    <ul className="space-y-1">
                      {passwordStrengthFeedback.map((feedback, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#8d99ae]">
                          <span className="text-[#8d99ae]/60 mt-0.5">•</span>
                          <span>{feedback}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                      {/* Success State */}
                      {passwordScore >= 3 && passwordStrengthFeedback.length === 0 && (
                        <div className="flex items-center gap-2 text-xs text-success font-medium">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Password meets all requirements
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirm Login Password</Label>
                  <div className="relative">
                    <Input
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
                      className="pr-12"
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
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
                    <p id="signup-confirm-error" className="mt-2 text-xs text-destructive">
                      {confirmError}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Master Password Section */}
              <div className="space-y-4 rounded-lg bg-warning/5 p-4 border border-warning/20">
                <div className="flex items-start gap-2">
                  <div className="rounded-full bg-warning/10 p-2">
                    <Lock className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <h3 className="mb-1 flex items-center gap-2">
                      Master Password
                      <span className="text-xs font-normal text-warning">(Critical)</span>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Encrypts your vault. <strong className="text-warning">Cannot be reset or recovered.</strong>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-master-password">Master Password</Label>
                  <div className="relative">
                    <Input
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
                      className="pr-12"
                      placeholder="Create master password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMasterPassword(!showMasterPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
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
                    <p id="signup-master-password-error" className="mt-2 text-xs text-destructive">
                      {masterPasswordError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-master">Confirm Master Password</Label>
                  <div className="relative">
                    <Input
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
                      className="pr-12"
                      placeholder="Confirm master password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmMasterPassword(!showConfirmMasterPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
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
                <p id="signup-confirm-master-error" className="mt-2 text-xs text-destructive">
                  {confirmMasterPasswordError}
                </p>
              )}
            </div>
          </div>

          {generalError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{generalError}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="text-sm text-center mt-6 text-muted-foreground">
          Already have an account?{' '}
          <Link 
            href="/login" 
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
      </div>
    </div>
  );
}
