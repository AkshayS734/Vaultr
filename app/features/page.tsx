import Link from 'next/link';
import { ArrowLeft, Key, Zap, Database, Search } from 'lucide-react';

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-12 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
        
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Features</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A comprehensive toolset for managing your credentials and digital secrets.
          </p>
        </div>

        <div className="grid gap-12 md:grid-cols-2">
          {/* Feature: Password Generation */}
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold">Smart Generator</h3>
            <p className="text-muted-foreground leading-relaxed">
              Create cryptographically secure passwords and passphrases instantly. Adjust length and character sets to meet the specific complexity requirements of any service.
            </p>
          </div>

          {/* Feature: Multi-Secret Support */}
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Key className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold">Flexible Secret Types</h3>
            <p className="text-muted-foreground leading-relaxed">
              Store more than just passwords. Vaultr provides structured formats for API keys, secure notes, and multi-line environment variables, keeping all your sensitive data in one place.
            </p>
          </div>

          {/* Feature: Breach Monitoring */}
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold">Exposure Checking</h3>
            <p className="text-muted-foreground leading-relaxed">
              Integrates with the Have I Been Pwned API using k-anonymity. Vaultr checks if your passwords have appeared in known data breaches without ever transmitting your actual password hash.
            </p>
          </div>

          {/* Feature: Self Hosting */}
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Database className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold">Deployment Ready</h3>
            <p className="text-muted-foreground leading-relaxed">
              Designed as a self-hostable solution. Deploy Vaultr on your own infrastructure using standard Node.js and PostgreSQL environments to maintain complete sovereignty over your data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
