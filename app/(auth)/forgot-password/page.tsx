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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {!showSuccess ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              Reset Password
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <label className="block">
                <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
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
                  className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-white ${
                    emailError ? "border-red-500" : "border-gray-200"
                  }`}
                  placeholder="your@email.com"
                />
                {emailError && (
                  <p id="forgot-email-error" className="mt-1 text-sm text-red-600">
                    {emailError}
                  </p>
                )}
              </label>

              {generalError && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20">
                  <p className="text-sm text-red-800 dark:text-red-200">{generalError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow ${
                  isSubmitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-6">
              Remember your password?{" "}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Back to login
              </Link>
            </p>
          </>
        ) : (
          <div className="text-center">
            <div className="inline-block mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Email Sent!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {successMessage}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              The reset link will expire in 24 hours. If you don&apos;t receive the email, check your spam folder.
            </p>
            <Link
              href="/login"
              className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Back to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
