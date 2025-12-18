"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type VerificationStatus = 
  | "loading" 
  | "success" 
  | "invalid-token" 
  | "expired-token" 
  | "already-verified" 
  | "server-error" 
  | "no-token";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<VerificationStatus>(
    token ? "loading" : "no-token"
  );
  const [message, setMessage] = useState<string>(
    token ? "" : "No verification token provided. Please use the link from your email."
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let isMounted = true;

    const verifyEmail = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!isMounted) return;

        if (res.ok) {
          setStatus("success");
          setMessage(data?.message || "Email verified successfully! Redirecting to sign in...");
          // Redirect after 2 seconds
          setTimeout(() => {
            if (isMounted) {
              router.replace("/login");
            }
          }, 2000);
        } else if (res.status === 400) {
          // Parse error message to determine specific error type
          const errorMsg = data?.error || "";
          
          if (errorMsg.includes("expired")) {
            setStatus("expired-token");
            setMessage("Verification token has expired. Please request a new one from the login page.");
          } else if (errorMsg.includes("already verified")) {
            setStatus("already-verified");
            setMessage("Your email is already verified. You can now sign in.");
          } else {
            setStatus("invalid-token");
            setMessage(errorMsg || "Invalid verification token. Please check the link and try again.");
          }
        } else {
          setStatus("server-error");
          setMessage("An error occurred while verifying your email. Please try again later.");
        }
      } catch {
        if (!isMounted) return;
        setStatus("server-error");
        setMessage("An error occurred while verifying your email. Please try again later.");
      }
    };

    verifyEmail();

    return () => {
      isMounted = false;
    };
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {status === "loading" && (
          <div className="text-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
              Verifying Email
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we verify your email address...
            </p>
          </div>
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
              Email Verified!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>
            <Link
              href="/login"
              className="inline-block w-full bg-blue-500 hover:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Go to Sign In
            </Link>
          </div>
        )}

        {status === "already-verified" && (
          <div className="text-center">
            <div className="inline-block mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Already Verified
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>
            <Link
              href="/login"
              className="inline-block w-full bg-blue-500 hover:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Go to Sign In
            </Link>
          </div>
        )}

        {status === "expired-token" && (
          <div className="text-center">
            <div className="inline-block mb-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-orange-600 dark:text-orange-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Link Expired
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>
            <div className="space-y-3">
              <Link
                href="/login"
                className="inline-block w-full bg-blue-500 hover:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Go to Sign In
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You can request a new verification email on the login page.
              </p>
            </div>
          </div>
        )}

        {status === "invalid-token" && (
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
              Invalid Link
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Make sure you clicked the correct link from your email.
              </p>
              <Link
                href="/login"
                className="inline-block w-full bg-blue-500 hover:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        )}

        {status === "server-error" && (
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
                    d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Verification Failed
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please try again or contact support if the problem persists.
              </p>
              <Link
                href="/login"
                className="inline-block w-full bg-blue-500 hover:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        )}

        {status === "no-token" && (
          <div className="text-center">
            <div className="inline-block mb-4">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
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
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please click the verification link from your email or sign up again.
              </p>
              <Link
                href="/signup"
                className="inline-block w-full bg-blue-500 hover:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Sign Up
              </Link>
              <Link
                href="/login"
                className="inline-block w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold py-2 px-4 rounded-lg transition duration-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
