"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateVaultKey, deriveKeyFromPasswordScrypt, encryptVaultKey, arrayBufferToBase64, generateKdfParamsScrypt } from "@/lib/crypto";

// Match Zod schemas from @/schemas/auth
function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: string) {
  return password.length >= 8 && password.length <= 128;
}

function passwordStrength(pw: string) {
  if (pw.length >= 12) return "strong";
  if (pw.length >= 8) return "medium";
  if (pw.length > 0) return "weak";
  return "";
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmMasterPassword, setConfirmMasterPassword] = useState("");
  
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [masterPasswordError, setMasterPasswordError] = useState<string | null>(null);
  const [confirmMasterPasswordError, setConfirmMasterPasswordError] = useState<string | null>(null);
  
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

    if (!isValidPassword(password)) {
      setPasswordError("Password must be 8-128 characters");
      ok = false;
    } else {
      setPasswordError(null);
    }

    if (password !== confirm) {
      setConfirmError("Passwords do not match");
      ok = false;
    } else {
      setConfirmError(null);
    }

    if (!isValidPassword(masterPassword)) {
      setMasterPasswordError("Master Password must be 8-128 characters");
      ok = false;
    } else {
      setMasterPasswordError(null);
    }

    if (masterPassword !== confirmMasterPassword) {
      setConfirmMasterPasswordError("Master Passwords do not match");
      ok = false;
    } else {
      setConfirmMasterPasswordError(null);
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
      // Generate Salt (16 bytes random)
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = arrayBufferToBase64(salt.buffer);

      // Generate Vault Key (random 256-bit AES key)
      const vaultKey = await generateVaultKey();

      // Derive KEK using scrypt (current default, memory-hard ~64 MiB)
      const kek = await deriveKeyFromPasswordScrypt(masterPassword, salt);

      // Encrypt Vault Key with KEK
      const encryptedVaultKey = await encryptVaultKey(vaultKey, kek);

      // Generate KDF parameters (includes version identifier for backward compatibility)
      const kdfParams = generateKdfParamsScrypt();

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          encryptedVaultKey, 
          salt: saltBase64, 
          kdfParams 
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setGeneralError(data?.error || 'Unable to create account');
        return;
      }

      // On success, redirect to login for now
      router.replace('/login');
    } catch (err) {
      console.error(err);
      setGeneralError('Unable to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const strength = passwordStrength(password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Create your Vaultr account</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Start securing your passwords with AES-256 encryption.</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label className="block">
            <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
            <input
              id="signup-email"
              type="email"
              required
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "signup-email-error" : undefined}
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
              <p id="signup-email-error" className="mt-1 text-sm text-red-600">
                {emailError}
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-gray-700 dark:text-gray-300">Login Password</span>
            <input
              id="signup-password"
              type="password"
              required
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "signup-password-error" : undefined}
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
              <p id="signup-password-error" className="mt-1 text-sm text-red-600">
                {passwordError}
              </p>
            )}

            {strength && (
              <p className="mt-1 text-sm">
                <span className="font-medium">Strength:</span>{' '}
                <span className={
                  strength === 'strong' ? 'text-green-600' : strength === 'medium' ? 'text-yellow-600' : 'text-red-600'
                }>{strength}</span>
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-gray-700 dark:text-gray-300">Confirm Login Password</span>
            <input
              id="signup-confirm"
              type="password"
              required
              aria-invalid={!!confirmError}
              aria-describedby={confirmError ? "signup-confirm-error" : undefined}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (confirmError) setConfirmError(null);
              }}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-white ${
                confirmError ? "border-red-500" : "border-gray-200"
              }`}
            />
            {confirmError && (
              <p id="signup-confirm-error" className="mt-1 text-sm text-red-600">
                {confirmError}
              </p>
            )}
          </label>

          <div className="border-t border-gray-200 dark:border-gray-700 my-4 pt-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Security Setup</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Create a Master Password to encrypt your vault. This password is NEVER sent to our servers and cannot be recovered if lost.
            </p>

            <label className="block mb-4">
              <span className="text-sm text-gray-700 dark:text-gray-300">Master Password</span>
              <input
                id="signup-master-password"
                type="password"
                required
                aria-invalid={!!masterPasswordError}
                aria-describedby={masterPasswordError ? "signup-master-password-error" : undefined}
                value={masterPassword}
                onChange={(e) => {
                  setMasterPassword(e.target.value);
                  if (masterPasswordError) setMasterPasswordError(null);
                }}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-white ${
                  masterPasswordError ? "border-red-500" : "border-gray-200"
                }`}
              />
              {masterPasswordError && (
                <p id="signup-master-password-error" className="mt-1 text-sm text-red-600">
                  {masterPasswordError}
                </p>
              )}
            </label>

            <label className="block">
              <span className="text-sm text-gray-700 dark:text-gray-300">Confirm Master Password</span>
              <input
                id="signup-confirm-master"
                type="password"
                required
                aria-invalid={!!confirmMasterPasswordError}
                aria-describedby={confirmMasterPasswordError ? "signup-confirm-master-error" : undefined}
                value={confirmMasterPassword}
                onChange={(e) => {
                  setConfirmMasterPassword(e.target.value);
                  if (confirmMasterPasswordError) setConfirmMasterPasswordError(null);
                }}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-white ${
                  confirmMasterPasswordError ? "border-red-500" : "border-gray-200"
                }`}
              />
              {confirmMasterPasswordError && (
                <p id="signup-confirm-master-error" className="mt-1 text-sm text-red-600">
                  {confirmMasterPasswordError}
                </p>
              )}
            </label>
          </div>

          {generalError && <p className="text-sm text-red-600">{generalError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow ${
              isSubmitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
