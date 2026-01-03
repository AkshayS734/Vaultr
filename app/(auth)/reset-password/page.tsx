"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { checkPasswordStrength, getStrengthLabel, getStrengthColor } from "@/app/lib/password-strength";
import { generatePassword } from "@/app/lib/password-generator";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        {status === "form" && (
          <>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Enter a new password for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      required
                      aria-invalid={!!passwordError}
                      aria-describedby={passwordError ? "password-error" : undefined}
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      className={`pl-10 pr-20 ${passwordError ? 'border-destructive' : ''}`}
                      placeholder="Create a strong password"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newPassword = generatePassword({ length: 16 })
                        setPassword(newPassword)
                        setConfirmPassword(newPassword)
                        setShowPassword(true)
                      }}
                      className="absolute right-11 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                      title="Generate password"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 22l-.394-1.433a2.25 2.25 0 00-1.423-1.423L13.25 19l1.433-.394a2.25 2.25 0 001.423-1.423L16.5 15.75l.394 1.433a2.25 2.25 0 001.423 1.423L19.75 19l-1.433.394a2.25 2.25 0 00-1.423 1.423z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-4 space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
                      {/* Strength Indicator Bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">Strength</span>
                          <span className={`text-xs font-semibold ${passwordScore >= 3 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                            {getStrengthLabel(passwordScore)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${getStrengthColor(passwordScore)}`}
                            style={{ width: `${Math.min(100, (passwordScore / 5) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Requirements Checklist */}
                      {passwordStrengthFeedback.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Unmet requirements:</p>
                          <ul className="space-y-1">
                            {passwordStrengthFeedback.map((feedback, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className="text-muted-foreground/60 mt-0.5">•</span>
                                <span>{feedback}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Success State */}
                      {passwordScore >= 3 && passwordStrengthFeedback.length === 0 && (
                        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle className="w-4 h-4" />
                          <span>Password meets all requirements</span>
                        </div>
                      )}
                    </div>
                  )}
                  {passwordError && (
                    <p id="password-error" className="text-xs text-destructive">
                      {passwordError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      aria-invalid={!!confirmError}
                      aria-describedby={confirmError ? "confirm-error" : undefined}
                      value={confirmPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setConfirmPassword(e.target.value);
                        if (confirmError) setConfirmError(null);
                      }}
                      className={`pl-10 pr-10 ${confirmError ? 'border-destructive' : ''}`}
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmError && (
                    <p id="confirm-error" className="text-xs text-destructive">
                      {confirmError}
                    </p>
                  )}
                </div>

                {generalError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{generalError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? "Resetting..." : "Reset Password"}
                </Button>
              </form>

              <p className="text-sm text-center text-muted-foreground">
                <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                  Back to login
                </Link>
              </p>
            </CardContent>
          </>
        )}

        {status === "success" && (
          <CardContent className="text-center py-8">
            <div className="inline-block mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-primary/10">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="mb-2">Password Reset!</CardTitle>
            <CardDescription className="mb-6">{message}</CardDescription>
            <Link href="/login" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 w-full">
              Go to Sign In
            </Link>
          </CardContent>
        )}

        {status === "error" && (
          <CardContent className="text-center py-8">
            <div className="inline-block mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-destructive/10">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="mb-2">Invalid Request</CardTitle>
            <CardDescription className="mb-6">{message}</CardDescription>
            <Link href="/login" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 w-full">
              Back to Sign In
            </Link>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
