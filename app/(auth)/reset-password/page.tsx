"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function isValidPassword(password: string) {
  return password.length >= 8 && password.length <= 128;
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"loading" | "form" | "success" | "error">(
    token ? "form" : "error"
  );
  const [message, setMessage] = useState<string>(
    token ? "" : "No reset token provided. Please use the link from your email."
  );

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No reset token provided. Please use the link from your email.");
    }
  }, [token]);

  function validate(): boolean {
    let ok = true;

    if (!isValidPassword(password)) {
      setPasswordError("Password must be 8-128 characters");
      ok = false;
    } else {
      setPasswordError(null);
    }

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match");
      ok = false;
    } else {
      setConfirmError(null);
    }

    return ok;
  }

  function getPasswordStrength(pw: string) {
    if (pw.length >= 12) return { score: "strong", color: "bg-green-500", label: "Strong" };
    if (pw.length >= 8) return { score: "medium", color: "bg-yellow-500", label: "Medium" };
    return { score: "weak", color: "bg-red-500", label: "Weak" };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGeneralError(data?.error || "Failed to reset password. Please try again.");
        return;
      }

      setStatus("success");
      setMessage("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        router.replace("/login");
      }, 2000);
    } catch {
      setGeneralError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const strength = getPasswordStrength(password);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#2b2d42' }}>
      {/* Back to home link */}
      <Link 
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
        style={{ color: '#ffffff', opacity: 0.6 }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to home
      </Link>
      
      <div 
        className="w-full max-w-[440px] rounded-xl p-8"
        style={{ 
          backgroundColor: 'rgba(0,0,0,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
      >
        {status === "form" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" style={{ color: '#ffffff' }}>
                Reset Password
              </h1>
              <p className="text-sm" style={{ color: '#ffffff', opacity: 0.7 }}>
                Enter a new password for your account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <label className="block">
                <span className="text-sm font-medium mb-2 block" style={{ color: '#ffffff', opacity: 0.85 }}>
                  New Password
                </span>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? "password-error" : undefined}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    className="w-full px-4 py-3 pr-12 rounded-lg text-sm transition-all duration-200 outline-none"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: passwordError ? '1px solid rgba(141,153,174,0.6)' : '1px solid rgba(141,153,174,0.2)',
                      color: '#ffffff',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(141,153,174,0.6)'}
                    onBlur={(e) => {
                      if (!passwordError) e.target.style.borderColor = 'rgba(141,153,174,0.2)';
                    }}
                    placeholder="Create a strong password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-opacity hover:opacity-100"
                    style={{ color: '#8d99ae', opacity: 0.6 }}
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
                {password && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1" style={{ color: '#ffffff', opacity: 0.7 }}>
                      <span>Password strength:</span>
                      <span style={{ color: '#8d99ae', opacity: strength.score === 'strong' ? 1 : strength.score === 'medium' ? 0.8 : 0.6 }}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="h-1 rounded overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          backgroundColor: '#8d99ae',
                          opacity: strength.score === 'strong' ? 1 : strength.score === 'medium' ? 0.7 : 0.4,
                          width: strength.score === "strong" ? "100%" : strength.score === "medium" ? "66%" : "33%",
                        }}
                      ></div>
                    </div>
                  </div>
                )}
                {passwordError && (
                  <p id="password-error" className="mt-2 text-xs" style={{ color: '#8d99ae', opacity: 0.9 }}>
                    {passwordError}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-medium mb-2 block" style={{ color: '#ffffff', opacity: 0.85 }}>
                  Confirm Password
                </span>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    aria-invalid={!!confirmError}
                    aria-describedby={confirmError ? "confirm-error" : undefined}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (confirmError) setConfirmError(null);
                    }}
                    className="w-full px-4 py-3 pr-12 rounded-lg text-sm transition-all duration-200 outline-none"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: confirmError ? '1px solid rgba(141,153,174,0.6)' : '1px solid rgba(141,153,174,0.2)',
                      color: '#ffffff',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(141,153,174,0.6)'}
                    onBlur={(e) => {
                      if (!confirmError) e.target.style.borderColor = 'rgba(141,153,174,0.2)';
                    }}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-opacity hover:opacity-100"
                    style={{ color: '#8d99ae', opacity: 0.6 }}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
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
                  <p id="confirm-error" className="mt-2 text-xs" style={{ color: '#8d99ae', opacity: 0.9 }}>
                    {confirmError}
                  </p>
                )}
              </label>

              {generalError && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(141,153,174,0.15)' }}>
                  <p className="text-sm" style={{ color: '#8d99ae' }}>{generalError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-lg"
                style={{
                  backgroundColor: isSubmitting ? 'rgba(141,153,174,0.5)' : '#8d99ae',
                  color: '#2b2d42',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <p className="text-sm text-center mt-6" style={{ color: '#ffffff', opacity: 0.6 }}>
              <Link 
                href="/login" 
                className="font-medium transition-opacity hover:opacity-80"
                style={{ color: '#8d99ae' }}
              >
                Back to login
              </Link>
            </p>
          </>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="inline-block mb-4">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(141,153,174,0.2)' }}
              >
                <svg
                  className="w-8 h-8"
                  style={{ color: '#8d99ae' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#ffffff' }}>
              Password Reset!
            </h1>
            <p className="text-sm mb-6" style={{ color: '#ffffff', opacity: 0.7 }}>
              {message}
            </p>
            <Link
              href="/login"
              className="inline-block w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-lg"
              style={{ 
                backgroundColor: '#8d99ae',
                color: '#2b2d42'
              }}
            >
              Go to Sign In
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <div className="inline-block mb-4">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(141,153,174,0.15)' }}
              >
                <svg
                  className="w-8 h-8"
                  style={{ color: '#8d99ae', opacity: 0.8 }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#ffffff' }}>
              Invalid Request
            </h1>
            <p className="text-sm mb-6" style={{ color: '#ffffff', opacity: 0.7 }}>
              {message}
            </p>
            <Link
              href="/login"
              className="inline-block w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-lg"
              style={{ 
                backgroundColor: '#8d99ae',
                color: '#2b2d42'
              }}
            >
              Back to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
