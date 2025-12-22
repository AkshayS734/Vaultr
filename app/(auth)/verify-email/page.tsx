"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type VerificationStatus = 
  | "loading" 
  | "success" 
  | "invalid-token" 
  | "expired-token" 
  | "already-verified" 
  | "server-error" 
  | "no-token";

function VerifyEmailContent() {
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
        {status === "loading" && (
          <div className="text-center">
            <div className="inline-block mb-4">
              <div 
                className="animate-spin rounded-full h-12 w-12 border-[3px] border-[#8d99ae]/20 border-t-[#8d99ae]"
              ></div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-white">
              Verifying Email
            </h1>
            <p className="text-sm text-white/70">
              Please wait while we verify your email address...
            </p>
          </div>
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
              Email Verified!
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

        {status === "already-verified" && (
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-white">
              Already Verified
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

        {status === "expired-token" && (
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-white">
              Link Expired
            </h1>
            <p className="text-sm mb-6 text-white/70">
              {message}
            </p>
            <div className="space-y-3">
              <Link
                href="/login"
                className="inline-block w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-lg bg-[#8d99ae] text-[#2b2d42]"
              >
                Go to Sign In
              </Link>
              <p className="text-xs text-white/50">
                You can request a new verification email on the login page.
              </p>
            </div>
          </div>
        )}

        {status === "invalid-token" && (
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
              Invalid Link
            </h1>
            <p className="text-sm mb-4 text-white/70">
              {message}
            </p>
            <div className="space-y-3">
              <p className="text-xs mb-4 text-white/50">
                Make sure you clicked the correct link from your email.
              </p>
              <Link
                href="/login"
                className="inline-block w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-lg bg-[#8d99ae] text-[#2b2d42]"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        )}

        {status === "server-error" && (
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
                    d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-white">
              Verification Failed
            </h1>
            <p className="text-sm mb-4 text-white/70">
              {message}
            </p>
            <div className="space-y-3">
              <p className="text-xs mb-4 text-white/50">
                Please try again or contact support if the problem persists.
              </p>
              <Link
                href="/login"
                className="inline-block w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-lg bg-[#8d99ae] text-[#2b2d42]"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        )}

        {status === "no-token" && (
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
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-white">
              Invalid Request
            </h1>
            <p className="text-sm mb-4 text-white/70">
              {message}
            </p>
            <div className="space-y-3">
              <p className="text-xs mb-4 text-white/50">
                Please click the verification link from your email or sign up again.
              </p>
              <Link
                href="/signup"
                className="inline-block w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-lg bg-[#8d99ae] text-[#2b2d42]"
              >
                Sign Up
              </Link>
              <Link
                href="/login"
                className="inline-block w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-90 bg-[#8d99ae]/20 border border-[#8d99ae]/30 text-[#8d99ae]"
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
