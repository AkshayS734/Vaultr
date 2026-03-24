import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-12 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
        
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Effective Date: March 2026</p>

          <section className="space-y-6">
            <h2 className="text-2xl font-semibold border-b pb-2">1. Data Storage and Telemetry</h2>
            <p className="text-muted-foreground">
              Vaultr is designed to function with minimal required data. We collect your email address purely for account authentication and recovery identification. The application does not bundle third-party product analytics, ad-tracking scripts, or invasive telemetry.
            </p>

            <h2 className="text-2xl font-semibold border-b pb-2">2. Processing of Vault Content</h2>
            <p className="text-muted-foreground">
              Any secret you save (such as passwords, API keys, or notes) is encrypted natively on your device before reaching the database infrastructure. We process these encrypted payloads strictly for storage and retrieval. Our servers cannot read the plaintext values of your secrets.
            </p>

            <h2 className="text-2xl font-semibold border-b pb-2">3. Third-Party Integrations</h2>
            <p className="text-muted-foreground">
              Depending on your configuration, Vaultr may interact with the Have I Been Pwned algorithm for breach monitoring. This integration sends a 5-character SHA-1 prefix of your password, preserving anonymity and ensuring the full hash is never exposed to the network.
            </p>

            <h2 className="text-2xl font-semibold border-b pb-2">4. Data Deletion</h2>
            <p className="text-muted-foreground">
              When items are deleted from your vault, they are removed from active queries. Complete purging of soft-deleted records depends on the specific retention rules defined by the environment host.
            </p>

            <h2 className="text-2xl font-semibold border-b pb-2">5. Updates to This Policy</h2>
            <p className="text-muted-foreground">
              We may periodically update this policy to reflect changes in how the software handles data. Major architectural changes involving data flow will be formally documented in the release changelogs.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
