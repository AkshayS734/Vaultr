"use client";

import Link from "next/link";
import { useState } from "react";

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  function validate(): boolean {
    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError(null);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMessage(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGeneralError(data?.error || "Failed to send reset email");
        return;
      }

      setSuccessMessage(
        data?.message || "Password reset link sent to your email. Please check your inbox."
      );
      setShowSuccess(true);
      setEmail("");
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
        {!showSuccess ? (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2 text-white">
                Reset Password
              </h1>
              <p className="text-sm text-white/70">
                Enter your email address and we&apos;ll send you a link to reset your password
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <label className="block">
                <span className="text-sm font-medium mb-2 block text-white/85">
                  Email
                </span>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "forgot-email-error" : undefined}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  className={`w-full px-4 py-3 rounded-lg text-sm transition-all duration-200 outline-none bg-black/30 text-white border ${emailError ? 'border-[#8d99ae]/60' : 'border-[#8d99ae]/20'} focus:border-[#8d99ae]/60 focus:ring-2 focus:ring-[#8d99ae]/20`}
                  placeholder="your@email.com"
                />
                {emailError && (
                  <p id="forgot-email-error" className="mt-2 text-xs text-[#8d99ae] opacity-90">
                    {emailError}
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
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <p className="text-sm text-center mt-6 text-white/60">
              Remember your password?{" "}
              <Link 
                href="/login" 
                className="font-medium text-[#8d99ae] transition-opacity hover:opacity-80"
              >
                Back to login
              </Link>
            </p>
          </>
        ) : (
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
            <h2 className="text-2xl font-bold mb-2 text-white">
              Email Sent!
            </h2>
            <p className="text-sm mb-4 text-white/75">
              {successMessage}
            </p>
            <p className="text-xs mb-6 text-white/60">
              The reset link will expire in 24 hours. If you don&apos;t receive the email, check your spam folder.
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
