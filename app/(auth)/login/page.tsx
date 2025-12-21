"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  const [rememberMe, setRememberMe] = useState(false);
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

  // Load remember me data and rate limiting data from localStorage
  useEffect(() => {
    const remembered = localStorage.getItem("remembered_email");
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }

    // Load rate limiting data
    const storedEmail = remembered || email;
    if (storedEmail) {
      const stored = localStorage.getItem(`resend_lock_${storedEmail}`);
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();
        
        if (data.lockUntil > now) {
          setLockUntil(data.lockUntil);
          setResendAttempts(data.attempts || 0);
        } else if (data.lockUntil && now - data.lockUntil > 24 * 60 * 60 * 1000) {
          localStorage.removeItem(`resend_lock_${storedEmail}`);
          setResendAttempts(0);
          setLockUntil(null);
        } else {
          setResendAttempts(data.attempts || 0);
        }
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
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

      // Handle remember me
      if (rememberMe) {
        localStorage.setItem("remembered_email", email);
      } else {
        localStorage.removeItem("remembered_email");
      }

      // Success — redirect to dashboard
      router.replace('/dashboard');
    } catch {
      setGeneralError('Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Sign in to Vaultr</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter your credentials to access your vault.</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label className="block">
            <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
            <input
              id="login-email"
              type="email"
              required
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "login-email-error" : undefined}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-white ${
                emailError ? "border-red-500" : "border-gray-200"
              }`}
            />
            {emailError && (
              <p id="login-email-error" className="mt-1 text-sm text-red-600">
                {emailError}
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-gray-700 dark:text-gray-300">Password</span>
            <input
              id="login-password"
              type="password"
              required
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "login-password-error" : undefined}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-white ${
                passwordError ? "border-red-500" : "border-gray-200"
              }`}
            />
            {passwordError && (
              <p id="login-password-error" className="mt-1 text-sm text-red-600">
                {passwordError}
              </p>
            )}
          </label>

          <div className="flex items-center justify-between">
            <label className="inline-flex items-center text-sm text-gray-600 dark:text-gray-300">
              <input 
                type="checkbox" 
                className="mr-2 rounded" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              /> 
              Remember me
            </label>
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
              Forgot password?
            </Link>
          </div>

          {generalError && (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-200">{generalError}</p>
              </div>
              
              {isEmailNotVerified && (
                <div>
                  {resendMessage && (
                    <div className={`mb-3 p-3 rounded-md ${
                      resendMessage.includes('sent') 
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
                        : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
                    }`}>
                      <p className="text-sm">{resendMessage}</p>
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isResending || countdown > 0}
                    className={`w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ${
                      isResending || countdown > 0
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isResending 
                      ? 'Sending...' 
                      : countdown > 0 
                        ? `Wait ${formatCountdown(countdown)}` 
                        : 'Resend Verification Email'
                    }
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow ${
              isSubmitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
