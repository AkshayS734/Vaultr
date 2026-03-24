import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-12 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
        
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Effective Date: March 2026</p>

          <section className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">1. Scope of Use</h2>
            <p className="text-muted-foreground">
              Vaultr is an open-source secrets management project distributed under the AGPL-3.0 license. These terms apply to interactions with the source code and any hosted instances acting under the official project domains.
            </p>

            <h2 className="text-2xl font-semibold border-b pb-2">2. Liability and &quot;AS IS&quot; Disclaimer</h2>
            <p className="text-muted-foreground">
              The software is provided &quot;as is&quot;, without warranties of any kind, whether express or implied. The authors, maintainers, and copyright holders assume no liability for any claim, technical failure, data loss, or damages resulting from the use of Vaultr. You are responsible for maintaining backups of your critical data.
            </p>

            <h2 className="text-2xl font-semibold border-b pb-2">3. Account Integrity</h2>
            <p className="text-muted-foreground">
              Because Vaultr delegates cryptographic authority to the client, you are solely responsible for retaining your Master Password. Administrators cannot recover your data if you lose your encryption key, nor can the system autonomously reconstruct the decryption sequence.
            </p>

            <h2 className="text-2xl font-semibold border-b pb-2">4. Acceptable Behavior</h2>
            <p className="text-muted-foreground">
              If utilizing a hosted instance of Vaultr, you agree not to engage in malicious activities, including but not limited to automated vulnerability probing, denial-of-service traffic generation, or attempting to exploit the server infrastructure beyond its intended secrets management purpose.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
