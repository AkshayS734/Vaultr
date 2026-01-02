"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/vaultr-ui/button";
import { Input } from "@/components/vaultr-ui/input";
import { Label } from "@/components/vaultr-ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/vaultr-ui/card";
import { Lock, Mail } from "lucide-react";

// Match Zod schemas from @/schemas/auth
function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: string) {
  return password.length >= 8 && password.length <= 128;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Email verification state
  const [isEmailNotVerified, setIsEmailNotVerified] = useState(false);
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

    return ok;
  }

  const router = useRouter();



  // Load rate limiting data for the current email from cookies
  useEffect(() => {
    if (!email) {
      setResendAttempts(0);
      setLockUntil(null);
      return;
    }

    // Get resend lock cookie (set by server, read from document.cookie)
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {} as Record<string, string>);

    const lockCookieKey = `resend_lock_${email.toLowerCase()}`;
    const stored = cookies[lockCookieKey];
    
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const now = Date.now();
        
        if (data.lockUntil && data.lockUntil > now) {
          setLockUntil(data.lockUntil);
          setResendAttempts(data.attempts || 0);
        } else {
          setResendAttempts(data.attempts || 0);
        }
      } catch {
        // Invalid cookie, ignore
        setResendAttempts(0);
        setLockUntil(null);
      }
    } else {
      setResendAttempts(0);
      setLockUntil(null);
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
        // Note: The actual rate limit cookie is set by the server in the response
        // This is just client-side UI state for countdown display
        const newAttempts = resendAttempts + 1;
        const lockDuration = 30000 * Math.pow(2, newAttempts - 1);
        
        const newLockUntil = Date.now() + lockDuration;
        setLockUntil(newLockUntil);
        setResendAttempts(newAttempts);
        
        // Don't use localStorage - the cookie is set by the server
      } else if (res.status === 429) {
        // Backend rate limit reached (all 3 attempts used)
        setResendMessage('Too many resend attempts. You can try again in 1 hour.');
        setResendAttempts(3); // Mark as maxed out
        // Cookie is set by server in response headers
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Check if error is due to unverified email
        if (res.status === 403 && data?.code === 'EMAIL_NOT_VERIFIED') {
          setIsEmailNotVerified(true);
          setGeneralError(data?.error || 'Please verify your email address');
        } else {
          setIsEmailNotVerified(false);
          setGeneralError(data?.error || 'Unable to sign in');
        }
        return;
      }

      // Success — redirect to unlock page
      router.replace('/unlock');
    } catch {
      setGeneralError('Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2">Welcome to Vaultr</h1>
          <p className="text-muted-foreground">
            Sign in to your account
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Log In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
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
                    aria-describedby={emailError ? "login-email-error" : undefined}
                  />
                </div>
                {emailError && (
                  <p id="login-email-error" className="text-xs text-destructive">
                    {emailError}
                  </p>
                )}
              </div>

              {/* Login Password */}
              <div className="space-y-2">
                <Label htmlFor="login-password">Login Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your login password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    required
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? "login-password-error" : undefined}
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
                {passwordError && (
                  <p id="login-password-error" className="text-xs text-destructive">
                    {passwordError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  This password signs you in. It does NOT unlock your vault.
                </p>
              </div>

              {/* Forgot Password */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot login password?
                </button>
              </div>

              {/* Error Display */}
              {generalError && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{generalError}</p>
                  </div>
                  
                  {isEmailNotVerified && (
                    <div>
                      {resendMessage && (
                        <div className="mb-3 p-3 rounded-lg bg-primary/10">
                          <p className="text-sm text-primary">{resendMessage}</p>
                        </div>
                      )}
                      
                      <Button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={isResending || countdown > 0}
                        variant="outline"
                        className="w-full"
                      >
                        {isResending 
                          ? 'Sending...' 
                          : countdown > 0 
                            ? `Wait ${formatCountdown(countdown)}` 
                            : 'Resend Verification Email'
                        }
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Log In"}
              </Button>
            </form>

            {/* Sign Up Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => router.push('/signup')}
                  className="text-primary hover:underline"
                >
                  Create an account
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Note */}
        <div className="mt-6 rounded-lg bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">
            🔒 Vaultr uses zero-knowledge encryption. Your vault data is encrypted
            with your Master Password, which we never see or store.
          </p>
        </div>
      </div>
    </div>
  );
}
