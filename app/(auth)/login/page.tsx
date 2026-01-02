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
  const [showPassword, setShowPassword] = useState(false);
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

  // Load remembered email once on mount
  useEffect(() => {
    const remembered = localStorage.getItem("remembered_email");
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  // Load rate limiting data for the current email
  useEffect(() => {
    if (!email) return;

    const stored = localStorage.getItem(`resend_lock_${email}`);
    if (stored) {
      const data = JSON.parse(stored);
      const now = Date.now();
      
      if (data.lockUntil > now) {
        setLockUntil(data.lockUntil);
        setResendAttempts(data.attempts || 0);
      } else if (data.lockUntil && now - data.lockUntil > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`resend_lock_${email}`);
        setResendAttempts(0);
        setLockUntil(null);
      } else {
        setResendAttempts(data.attempts || 0);
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
      
      <div 
        className="w-full max-w-[440px] rounded-xl p-8 bg-black/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white">
            Welcome back
          </h1>
          <p className="text-sm text-white/70">
            Enter your credentials to access your secure vault
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <label className="block">
            <span className="text-sm font-medium mb-2 block text-white/85">
              Email
            </span>
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
              className={`w-full px-4 py-3 rounded-lg text-sm transition-all duration-200 outline-none bg-black/30 text-white border ${emailError ? 'border-[#8d99ae]/60' : 'border-[#8d99ae]/20'} focus:border-[#8d99ae]/60 focus:ring-2 focus:ring-[#8d99ae]/20`}
              placeholder="your@email.com"
            />
            {emailError && (
              <p id="login-email-error" className="mt-2 text-xs text-[#8d99ae] opacity-90">
                {emailError}
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium mb-2 block text-white/85">
              Password
            </span>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "login-password-error" : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                className={`w-full px-4 py-3 pr-12 rounded-lg text-sm transition-all duration-200 outline-none bg-black/30 text-white border ${passwordError ? 'border-[#8d99ae]/60' : 'border-[#8d99ae]/20'} focus:border-[#8d99ae]/60 focus:ring-2 focus:ring-[#8d99ae]/20`}
                placeholder="Enter your password"
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
              <p id="login-password-error" className="mt-2 text-xs text-[#8d99ae] opacity-90">
                {passwordError}
              </p>
            )}
          </label>

          <div className="flex items-center justify-between">
            <label className="inline-flex items-center text-sm cursor-pointer text-white/75">
              <input 
                type="checkbox" 
                className="mr-2 rounded accent-[#8d99ae]"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              /> 
              Remember email
            </label>
            <Link 
              href="/forgot-password" 
              className="text-sm text-[#8d99ae] transition-opacity hover:opacity-80"
            >
              Forgot password?
            </Link>
          </div>

          {generalError && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-[#8d99ae]/15">
                <p className="text-sm text-[#8d99ae]">{generalError}</p>
              </div>
              
              {isEmailNotVerified && (
                <div>
                  {resendMessage && (
                    <div className="mb-3 p-3 rounded-lg bg-[#8d99ae]/10">
                      <p className="text-sm text-[#8d99ae] opacity-90">{resendMessage}</p>
                    </div>
                  )}
                  
                  <button
                    type="button"
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
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${isSubmitting ? 'bg-[#8d99ae]/50 text-[#2b2d42] cursor-not-allowed opacity-70' : 'bg-[#8d99ae] text-[#2b2d42] hover:shadow-lg'}`}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-sm text-center mt-6 text-white/60">
          Don&apos;t have an account?{' '}
          <Link 
            href="/signup" 
            className="font-medium text-[#8d99ae] transition-opacity hover:opacity-80"
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
