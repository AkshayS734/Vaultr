'use client';

import Link from 'next/link';
import { Lock, Shield, Key, Zap, Code, ArrowRight, Check, Cloud, FileText, Lightbulb} from 'lucide-react';
import { Card, CardContent } from '@/app/components/ui/card';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Lock className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold">Vaultr</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                Log In
              </Link>
              <Link href="/signup" className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <h1 className="mb-6 text-4xl sm:text-5xl lg:text-6xl font-bold">
            Your Secrets,
            <br />
            <span className="text-primary">Truly Secure</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Vaultr is a zero-knowledge password manager that puts you in complete
            control. Store passwords, API keys, and environment variables with
            client-side encryption.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/signup" className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-md px-6 text-base">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border bg-background text-foreground hover:bg-accent hover:text-accent-foreground h-10 rounded-md px-6 text-base">
              Sign In
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required • Open source • Self-hostable
          </p>
        </div>
      </section>

      {/* Two Password System */}
      <section className="border-t border-border bg-card/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl sm:text-4xl font-bold">The Two-Password System</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Vaultr uses two separate passwords for maximum security and flexibility
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Login Password */}
            <Card className="border-2">
              <CardContent className="p-8">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <Lock className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mb-3 text-xl font-semibold">Login Password</h3>
                <p className="mb-6 text-muted-foreground">
                  Used to sign in to your Vaultr account. This password can be reset
                  via email if forgotten.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span className="text-sm">Account authentication</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span className="text-sm">Resettable via email</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span className="text-sm">Standard security requirements</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Master Password */}
            <Card className="border-2 border-amber-200/30 bg-amber-50/5">
              <CardContent className="p-8">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100/20">
                  <Key className="h-7 w-7 text-amber-600" />
                </div>
                <h3 className="mb-3 text-xl font-semibold">Master Password</h3>
                <p className="mb-6 text-muted-foreground">
                  Encrypts and decrypts your vault. Never stored or transmitted.
                  Cannot be recovered if lost.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
                    <span className="text-sm">Client-side encryption key</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
                    <span className="text-sm">Never leaves your device</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
                    <span className="text-sm">Cannot be reset or recovered</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 rounded-xl bg-primary/5 border border-primary/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              <Lightbulb className="inline-block mr-1 h-5 w-5 text-yellow-500" />
              <strong>Why two passwords?</strong> This separation ensures that
              even if someone gains access to your account, they cannot decrypt your
              vault without your Master Password—which we never see.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl sm:text-4xl font-bold">Built for Security-Conscious Users</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Everything you need to manage your digital security
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">Zero-Knowledge Encryption</h3>
                <p className="text-sm text-muted-foreground">
                  All data is encrypted on your device before it reaches our
                  servers. We can&apos;t see your passwords—ever.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Key className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">Password Management</h3>
                <p className="text-sm text-muted-foreground">
                  Store unlimited passwords with auto-fill support, secure
                  sharing, and breach monitoring.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">Password Generator</h3>
                <p className="text-sm text-muted-foreground">
                  Create strong, unique passwords with customizable length and
                  character requirements.
                </p>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Code className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">API Key Storage</h3>
                <p className="text-sm text-muted-foreground">
                  Securely store API keys, tokens, and other developer
                  credentials with one-click copying.
                </p>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">Environment Variables</h3>
                <p className="text-sm text-muted-foreground">
                  Securely store and manage environment variables and secrets with client-side encryption.
                </p>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Cloud className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">Self-Hostable</h3>
                <p className="text-sm text-muted-foreground">
                  Run Vaultr on your own infrastructure for full control over your data and security.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="border-t border-border bg-card/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl sm:text-4xl font-bold">Security You Can Trust</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Built with industry-standard security practices
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-card p-6 text-center">
              <p className="mb-2 text-2xl font-bold text-primary">AES-256</p>
              <p className="text-sm text-muted-foreground">Encryption Standard</p>
            </div>
            <div className="rounded-lg bg-card p-6 text-center">
              <p className="mb-2 text-2xl font-bold text-primary">100%</p>
              <p className="text-sm text-muted-foreground">Open Source</p>
            </div>
            <div className="rounded-lg bg-card p-6 text-center">
              <p className="mb-2 text-2xl font-bold text-primary">Zero</p>
              <p className="text-sm text-muted-foreground">Knowledge Architecture</p>
            </div>
            <div className="rounded-lg bg-card p-6 text-center">
              <p className="mb-2 text-2xl font-bold text-primary">Auditable</p>
              <p className="text-sm text-muted-foreground">Security-first architecture</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-12 text-center">
              <h2 className="mb-4 text-3xl sm:text-4xl font-bold">Ready to Secure Your Digital Life?</h2>
              <p className="mb-8 text-lg text-muted-foreground">
                Built for developers and security-conscious users who want full control.
              </p>
              <Link href="/signup" className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-md px-6 text-base">
                Create Your Free Account
                <ArrowRight className=" h-5 w-5" />
              </Link>
              <p className="mt-4 text-sm text-muted-foreground">
                No credit card required • Free to use • Open source
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <span className="font-semibold">Vaultr</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Zero-knowledge password manager for security-conscious users.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#features" className="hover:text-foreground transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Security
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Roadmap
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Security Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    GDPR
                  </a>
                </li>
              </ul>
            </div>
          </div> */}
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2025 Akshay Shukla. All rights reserved.</p>
            <p className="mt-2">
              Built with zero-knowledge encryption. Your data is yours alone.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}