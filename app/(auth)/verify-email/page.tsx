"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/app/components/ui/card";
import { CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="pt-6">
            {status === "loading" && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
                <h1 className="mb-2 text-2xl font-bold">Verifying Email</h1>
                <p className="text-sm text-muted-foreground">
                  Please wait while we verify your email address...
                </p>
              </div>
            )}

            {status === "success" && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h1 className="mb-2 text-2xl font-bold">Email Verified!</h1>
                <p className="mb-6 text-sm text-muted-foreground">
                  {message}
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                >
                  Go to Sign In
                </Link>
              </div>
            )}

            {status === "already-verified" && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h1 className="mb-2 text-2xl font-bold">Already Verified</h1>
                <p className="mb-6 text-sm text-muted-foreground">
                  {message}
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                >
                  Go to Sign In
                </Link>
              </div>
            )}

            {status === "expired-token" && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
                <h1 className="mb-2 text-2xl font-bold">Link Expired</h1>
                <p className="mb-4 text-sm text-muted-foreground">
                  {message}
                </p>
                <p className="mb-6 text-xs text-muted-foreground">
                  You can request a new verification email on the login page.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                >
                  Go to Sign In
                </Link>
              </div>
            )}

            {status === "invalid-token" && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <h1 className="mb-2 text-2xl font-bold">Invalid Link</h1>
                <p className="mb-4 text-sm text-muted-foreground">
                  {message}
                </p>
                <p className="mb-6 text-xs text-muted-foreground">
                  Make sure you clicked the correct link from your email.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                >
                  Go to Sign In
                </Link>
              </div>
            )}

            {status === "server-error" && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <h1 className="mb-2 text-2xl font-bold">Verification Failed</h1>
                <p className="mb-4 text-sm text-muted-foreground">
                  {message}
                </p>
                <p className="mb-6 text-xs text-muted-foreground">
                  Please try again or contact support if the problem persists.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                >
                  Go to Sign In
                </Link>
              </div>
            )}

            {status === "no-token" && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h1 className="mb-2 text-2xl font-bold">Invalid Request</h1>
                <p className="mb-4 text-sm text-muted-foreground">
                  {message}
                </p>
                <p className="mb-6 text-xs text-muted-foreground">
                  Please click the verification link from your email or sign up again.
                </p>
                <div className="space-y-3">
                  <Link
                    href="/signup"
                    className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                  >
                    Create Account
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 border bg-background text-foreground hover:bg-accent hover:text-accent-foreground w-full"
                  >
                    Go to Sign In
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
