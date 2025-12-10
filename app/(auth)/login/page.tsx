"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    let ok = true;
    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address");
      ok = false;
    } else {
      setEmailError(null);
    }

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      ok = false;
    } else {
      setPasswordError(null);
    }

    return ok;
  }

  const router = useRouter();

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
        setGeneralError(data?.error || 'Unable to sign in');
        return;
      }

        // Success — redirect to dashboard
      router.replace('/dashboard');
    } catch (err) {
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
              <input type="checkbox" className="mr-2" /> Remember me
            </label>
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              Forgot?
            </Link>
          </div>

          {generalError && <p className="text-sm text-red-600">{generalError}</p>}

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
