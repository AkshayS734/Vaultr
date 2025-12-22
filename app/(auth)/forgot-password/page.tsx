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
        {!showSuccess ? (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" style={{ color: '#ffffff' }}>
                Reset Password
              </h1>
              <p className="text-sm" style={{ color: '#ffffff', opacity: 0.7 }}>
                Enter your email address and we&apos;ll send you a link to reset your password
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <label className="block">
                <span className="text-sm font-medium mb-2 block" style={{ color: '#ffffff', opacity: 0.85 }}>
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
                  className="w-full px-4 py-3 rounded-lg text-sm transition-all duration-200 outline-none"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: emailError ? '1px solid rgba(141,153,174,0.6)' : '1px solid rgba(141,153,174,0.2)',
                    color: '#ffffff',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(141,153,174,0.6)'}
                  onBlur={(e) => {
                    if (!emailError) e.target.style.borderColor = 'rgba(141,153,174,0.2)';
                  }}
                  placeholder="your@email.com"
                />
                {emailError && (
                  <p id="forgot-email-error" className="mt-2 text-xs" style={{ color: '#8d99ae', opacity: 0.9 }}>
                    {emailError}
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
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <p className="text-sm text-center mt-6" style={{ color: '#ffffff', opacity: 0.6 }}>
              Remember your password?{" "}
              <Link 
                href="/login" 
                className="font-medium transition-opacity hover:opacity-80"
                style={{ color: '#8d99ae' }}
              >
                Back to login
              </Link>
            </p>
          </>
        ) : (
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
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#ffffff' }}>
              Email Sent!
            </h2>
            <p className="text-sm mb-4" style={{ color: '#ffffff', opacity: 0.75 }}>
              {successMessage}
            </p>
            <p className="text-xs mb-6" style={{ color: '#ffffff', opacity: 0.6 }}>
              The reset link will expire in 24 hours. If you don&apos;t receive the email, check your spam folder.
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
