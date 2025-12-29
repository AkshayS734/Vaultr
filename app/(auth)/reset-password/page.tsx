"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { checkPasswordStrength, getStrengthLabel, getStrengthColor } from "@/app/lib/password-strength";

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
  const [passwordStrengthFeedback, setPasswordStrengthFeedback] = useState<string[]>([]);
  const [passwordScore, setPasswordScore] = useState(0);
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

  // Update password strength feedback in real-time
  useEffect(() => {
    if (!password) {
      setPasswordStrengthFeedback([]);
      setPasswordScore(0);
      return;
    }
    
    const result = checkPasswordStrength(password);
    setPasswordScore(result.score);
    setPasswordStrengthFeedback(result.feedback);
  }, [password]);

  function validate(): boolean {
    let ok = true;

    if (!isValidPassword(password)) {
      setPasswordError("Password must be 8-128 characters");
      ok = false;
    } else if (passwordStrengthFeedback.length > 0) {
      setPasswordError("Password does not meet strength requirements");
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
        {status === "form" && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2 text-white">
                Reset Password
              </h1>
              <p className="text-sm text-white/70">
                Enter a new password for your account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <label className="block">
                <span className="text-sm font-medium mb-2 block text-white/85">
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
                {password && (
                  <div className="mt-4 space-y-3 p-3 rounded-lg bg-[#8d99ae]/10 border border-[#8d99ae]/20">
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
                      <div className="flex items-center gap-2 text-xs text-green-400 font-medium">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Password meets all requirements
                      </div>
                    )}
                  </div>
                )}
                {passwordError && (
                  <p id="password-error" className="mt-2 text-xs text-[#8d99ae] opacity-90">
                    {passwordError}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-medium mb-2 block text-white/85">
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
                    className={`w-full px-4 py-3 pr-12 rounded-lg text-sm transition-all duration-200 outline-none bg-black/30 text-white border ${confirmError ? 'border-[#8d99ae]/60' : 'border-[#8d99ae]/20'} focus:border-[#8d99ae]/60 focus:ring-2 focus:ring-[#8d99ae]/20`}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8d99ae] opacity-60 transition-opacity hover:opacity-100"
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
                  <p id="confirm-error" className="mt-2 text-xs text-[#8d99ae] opacity-90">
                    {confirmError}
                  </p>
                )}
              </label>

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
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <p className="text-sm text-center mt-6 text-white/60">
              <Link 
                href="/login" 
                className="font-medium text-[#8d99ae] transition-opacity hover:opacity-80"
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
                className="w-14 h-14 rounded-full flex items-center justify-center bg-[#8d99ae]/20"
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-white">
              Password Reset!
            </h1>
            <p className="text-sm mb-6 text-white/70">
              {message}
            </p>
            <Link
              href="/login"
              className="inline-block w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-lg bg-[#8d99ae] text-[#2b2d42]"
            >
              Go to Sign In
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <div className="inline-block mb-4">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center bg-[#8d99ae]/15"
              >
                <svg
                  className="w-8 h-8 text-[#8d99ae] opacity-80"
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
            <h1 className="text-2xl font-bold mb-2 text-white">
              Invalid Request
            </h1>
            <p className="text-sm mb-6 text-white/70">
              {message}
            </p>
            <Link
              href="/login"
              className="inline-block w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-lg bg-[#8d99ae] text-[#2b2d42]"
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
