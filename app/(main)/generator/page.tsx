"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { useVault } from "@/app/components/providers/VaultProvider";
import { generatePassword } from "@/app/lib/password-generator";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  useToast,
  ToastProvider,
} from "../../../components/vaultr-ui";

function GeneratorContent() {
  const router = useRouter();
  const { addToast } = useToast();

  const [length, setLength] = useState(16);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [includeLower, setIncludeLower] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [password, setPassword] = useState("");

  const handleLogout = async () => {
    try {
      await fetch("/logout", { method: "POST" });
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const handleGenerate = () => {
    try {
      const next = generatePassword({
        length,
        includeUpper,
        includeLower,
        includeNumbers,
        includeSymbols,
      });
      setPassword(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate password";
      addToast({ message, type: "error" });
    }
  };

  const handleCopy = async () => {
    if (!password) {
      addToast({ message: "Generate a password first", type: "warning" });
      return;
    }
    try {
      await navigator.clipboard.writeText(password);
      addToast({ message: "Password copied to clipboard", type: "success" });
    } catch (err) {
      console.error("Copy failed", err);
      addToast({ message: "Could not copy to clipboard", type: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight whitespace-nowrap">
            Vaultr
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3 whitespace-nowrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => router.push("/dashboard")}
            >
              Back to dashboard
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Password Generator</h1>
          <p className="text-sm text-muted-foreground">
            Create strong, random passwords for your accounts.
          </p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Generated password</CardTitle>
            <CardDescription>Regenerate or copy when you are ready to use it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1 overflow-hidden rounded-lg bg-muted px-4 py-3">
              <p className="truncate font-mono text-lg">{password || "Click generate to create a password"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleCopy} aria-label="Copy password">
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="icon" onClick={handleGenerate} aria-label="Generate password">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generator options</CardTitle>
            <CardDescription>Customize your password requirements.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="length">Length</Label>
                <span className="text-sm font-medium">{length} characters</span>
              </div>
              <Input
                id="length"
                type="range"
                min={8}
                max={64}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
              />
            </div>

            <div className="space-y-4">
              <Label>Character types</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Uppercase Letters</p>
                    <p className="text-xs text-muted-foreground">A-Z</p>
                  </div>
                  <Switch checked={includeUpper} onChange={(e) => setIncludeUpper(e.target.checked)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Lowercase Letters</p>
                    <p className="text-xs text-muted-foreground">a-z</p>
                  </div>
                  <Switch checked={includeLower} onChange={(e) => setIncludeLower(e.target.checked)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Numbers</p>
                    <p className="text-xs text-muted-foreground">0-9</p>
                  </div>
                  <Switch checked={includeNumbers} onChange={(e) => setIncludeNumbers(e.target.checked)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Symbols</p>
                    <p className="text-xs text-muted-foreground">!@#$%^&*</p>
                  </div>
                  <Switch checked={includeSymbols} onChange={(e) => setIncludeSymbols(e.target.checked)} />
                </div>
              </div>
            </div>

            <Button onClick={handleGenerate} size="lg" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Generate password
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function GeneratorPage() {
  const { isUnlocked } = useVault();

  if (!isUnlocked) return null;

  return (
    <ToastProvider>
      <GeneratorContent />
    </ToastProvider>
  );
}
