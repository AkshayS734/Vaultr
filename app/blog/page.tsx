import Link from 'next/link';
import { ArrowLeft, Rss } from 'lucide-react';

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-12 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Changelog</h1>
            <p className="text-xl text-muted-foreground">
              Development updates, releases, and technical notes.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground shrink-0 hidden md:flex">
            <Rss className="h-5 w-5" />
          </div>
        </div>

        <div className="space-y-8 border-l border-border pl-8 relative">
          
          {/* Post 1 */}
          <article className="relative">
            <div className="absolute -left-[41px] top-1 h-4 w-4 rounded-full bg-primary border-4 border-background" />
            <div className="mb-2">
              <time className="text-sm font-medium text-muted-foreground">v0.1.0 — Initial Release</time>
            </div>
            <h2 className="text-2xl font-bold mb-3">
              The Foundation
            </h2>
            <div className="prose prose-slate dark:prose-invert text-muted-foreground">
              <p>
                We are excited to push the initial version of Vaultr. This release establishes the core architecture necessary for a secure, self-hostable secrets manager.
              </p>
              <ul>
                <li>Implemented client-side AES-256-GCM encryption pipeline.</li>
                <li>Built the credential management interface for passwords, notes, and API keys.</li>
                <li>Integrated k-anonymity checks against the Have I Been Pwned database.</li>
              </ul>
              <p>
                Our immediate focus will be on hardening the CI/CD pipeline and extending testing coverage before moving towards multi-device syncing features.
              </p>
            </div>
          </article>

        </div>
      </div>
    </div>
  );
}
