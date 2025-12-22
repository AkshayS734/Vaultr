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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {status === "form" && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              Reset Password
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Enter a new password for your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <label className="block">
                <span className="text-sm text-gray-700 dark:text-gray-300">New Password</span>
                <input
                  id="new-password"
                  type="password"
                  required
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-white ${
                    passwordError ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>Password strength:</span>
                      <span>{strength.label}</span>
                    </div>
                    <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded mt-1 overflow-hidden">
                      <div
                        className={`h-full ${strength.color} transition-all`}
                        style={{
                          width:
                            strength.score === "strong"
                              ? "100%"
                              : strength.score === "medium"
                                ? "66%"
                                : "33%",
                        }}
                      ></div>
                    </div>
                  </div>
                )}
                {passwordError && (
                  <p id="password-error" className="mt-1 text-sm text-red-600">
                    {passwordError}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-gray-300">Confirm Password</span>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  aria-invalid={!!confirmError}
                  aria-describedby={confirmError ? "confirm-error" : undefined}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmError) setConfirmError(null);
                  }}
                  className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-white ${
                    confirmError ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {confirmError && (
                  <p id="confirm-error" className="mt-1 text-sm text-red-600">
                    {confirmError}
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
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-6">
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Back to login
              </Link>
            </p>
          </>
        )}

        {status === "success" && (
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Password Reset!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>
            <Link
              href="/login"
              className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Go to Sign In
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <div className="inline-block mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Invalid Request
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
