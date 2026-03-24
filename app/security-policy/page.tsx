import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/app/components/ui/card';

export default function SecurityPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-12 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
        
        <div className="mb-16">
          <h1 className="text-4xl font-bold mb-4">Security Policy</h1>
          <p className="text-xl text-muted-foreground">
            Our approach to handling vulnerability reports and securing the application lifecycle.
          </p>
        </div>

        <Card className="border">
          <CardContent className="p-8 space-y-8">
            <section>
              <h2 className="text-2xl font-semibold border-b pb-2 mb-4">Vulnerability Disclosure</h2>
              <p className="text-muted-foreground mb-4">
                We take the security of Vaultr seriously. If you discover a vulnerability in the codebase, we ask that you adhere to responsible disclosure practices by providing us sufficient time to implement a fix before publicizing the flaw.
              </p>
              <p className="text-muted-foreground">
                Currently, Vaultr does not maintain an active financial bug bounty program, but we appreciate and acknowledge all contributions that improve the project&apos;s resilience.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold border-b pb-2 mb-4">In-Scope Areas</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Bypasses in client-side encryption logic or PBKDF2 handling.</li>
                <li>Authentication subversion or unauthorized data access.</li>
                <li>SQL injection vulnerabilities within the Prisma integration.</li>
                <li>Cross-Site Scripting (XSS) impacting secret decryption states.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold border-b pb-2 mb-4">Reporting a Vulnerability</h2>
              <div className="bg-muted border p-4 rounded-lg mb-4">
                <p className="text-foreground font-medium">Please avoid creating public issues or pull requests for severe vulnerabilities.</p>
              </div>
              <p className="text-muted-foreground mt-4">
                Submit all sensitive security reports directly to:
              </p>
              <p className="font-mono text-primary font-medium text-lg my-2">akshaysbuilds@gmail.com</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold border-b pb-2 mb-4">Supported Versions</h2>
              <p className="text-muted-foreground">
                We enforce security updates against the `main` branch. Forks or historically decoupled deployments are responsible for fetching the latest security patches manually.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
