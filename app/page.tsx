import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#2b2d42] text-white">
      {/* Header */}
      <header className="px-6 lg:px-12 h-20 flex items-center border-b border-white/10">
        <Link href="/" className="flex items-center">
          <span className="text-2xl font-bold tracking-tight text-white">
            Vaultr
          </span>
        </Link>
        <nav className="ml-auto flex gap-6 items-center">
          <Link 
            href="/login" 
            className="text-sm font-medium text-white/85 transition-opacity hover:opacity-80"
          >
            Login
          </Link>
          <Link 
            href="/signup" 
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:shadow-lg bg-[#8d99ae] text-[#2b2d42]"
          >
            Sign Up
          </Link>
        </nav>
      </header>

      {/* Hero Section - Full Viewport */}
      <main className="flex-1">
        <section className="flex items-center justify-center min-h-[calc(100vh-5rem)] px-6">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-6">
              <h1 
                className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight text-white"
              >
                Security-First Password Management
              </h1>
              <p 
                className="text-lg md:text-xl lg:text-2xl max-w-2xl mx-auto leading-relaxed text-white/75"
              >
                Enterprise-grade encryption meets intuitive design. Protect what matters with Vaultr.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link 
                href="/signup" 
                className="px-8 py-4 rounded-lg text-base font-semibold transition-all hover:shadow-xl hover:opacity-90 w-full sm:w-auto bg-[#8d99ae] text-[#2b2d42]"
              >
                Get Started Free
              </Link>
              <Link 
                href="/login" 
                className="text-base font-medium transition-opacity hover:opacity-80 w-full sm:w-auto py-4 text-[#8d99ae]"
              >
                View Demo →
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-6 border-t border-white/10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-4 mb-20">
              <div 
                className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase mb-2 bg-[#8d99ae] text-[#2b2d42] opacity-90"
              >
                Features
              </div>
              <h2 
                className="text-4xl md:text-5xl font-bold tracking-tight text-white"
              >
                Built for Modern Security
              </h2>
              <p 
                className="text-lg max-w-2xl mx-auto text-white/70"
              >
                Everything you need to manage passwords, API keys, and sensitive data securely.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
              <div className="space-y-4 p-8 rounded-xl transition-all bg-white/[0.02] hover:bg-white/5">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-[#8d99ae]">
                  <svg className="w-6 h-6 text-[#2b2d42]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 
                  className="text-xl font-bold text-white"
                >
                  Zero-Knowledge Encryption
                </h3>
                <p 
                  className="leading-relaxed text-white/70"
                >
                  AES-256 encryption with client-side hashing. Your master password never leaves your device.
                </p>
              </div>

              <div className="space-y-4 p-8 rounded-xl transition-all bg-white/[0.02] hover:bg-white/5">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-[#8d99ae]">
                  <svg className="w-6 h-6 text-[#2b2d42]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 
                  className="text-xl font-bold text-white"
                >
                  Seamless Sync
                </h3>
                <p 
                  className="leading-relaxed text-white/70"
                >
                  Access your vault from anywhere. Real-time synchronization across all your devices.
                </p>
              </div>

              <div className="space-y-4 p-8 rounded-xl transition-all bg-white/[0.02] hover:bg-white/5">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-[#8d99ae]">
                  <svg className="w-6 h-6 text-[#2b2d42]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 
                  className="text-xl font-bold text-white"
                >
                  Advanced Security
                </h3>
                <p 
                  className="leading-relaxed text-white/70"
                >
                  Multi-factor authentication, session management, and comprehensive audit logs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6 border-t border-white/10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 
              className="text-4xl md:text-5xl font-bold tracking-tight text-white"
            >
              Ready to secure your digital life?
            </h2>
            <p 
              className="text-lg md:text-xl text-white/75"
            >
              Join thousands who trust Vaultr to protect their most sensitive information.
            </p>
            <div className="pt-4">
              <Link 
                href="/signup" 
                className="inline-block px-10 py-4 rounded-lg text-base font-semibold transition-all hover:shadow-xl hover:opacity-90 bg-[#8d99ae] text-[#2b2d42]"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto text-center">
          <p 
            className="text-sm text-white/50"
          >
            © 2025 Vaultr. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}