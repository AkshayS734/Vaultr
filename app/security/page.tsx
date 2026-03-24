import Link from 'next/link';
import { ArrowLeft, Lock, EyeOff, Server } from 'lucide-react';

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-12 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
        
        <div className="mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Security Architecture</h1>
          <p className="text-xl text-muted-foreground">
            Transparency is fundamental to trust. Review the cryptographic primitives and infrastructure decisions that secure Vaultr.
          </p>
        </div>

        <div className="space-y-12">
          {/* Section 1 */}
          <section className="bg-card border rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Client-Side Cryptography</h2>
            </div>
            <div className="space-y-4 text-muted-foreground">
              <p>
                All encryption and decryption operations occur entirely within your browser utilizing the native Web Crypto API. The server only receives and stores the resulting ciphertext blocks.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Algorithm:</strong> AES-256 in Galois/Counter Mode (GCM).</li>
                <li><strong>Key Derivation:</strong> PBKDF2 with SHA-256 is used to derive a vault key from your Master Password and a user-specific salt.</li>
                <li><strong>Authentication:</strong> GCM provides authenticated encryption, ensuring that ciphertexts cannot be tampered with without immediate detection upon decryption.</li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-card border rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <EyeOff className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Data Isolation</h2>
            </div>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Vaultr employs a strict separation of concerns for user authentication versus data encryption.
              </p>
              <p>
                Logging into the application utilizes standard session tokens (HTTP-only cookies), while unlocking your vault localizes the derived encryption key strictly to application memory. The master key is never persisted to localStorage or session cookies, mitigating cross-site scripting (XSS) extraction risks.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-card border rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Server className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Infrastructure Defenses</h2>
            </div>
            <div className="space-y-4 text-muted-foreground">
              <p>
                The backend is built with Next.js App Router and Prisma, providing inherent protections against common web vulnerabilities.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Injection Prevention:</strong> Prisma ORM prevents SQL injection on all database queries.</li>
                <li><strong>Rate Limiting:</strong> Redis caching is utilized across authentication endpoints to throttle sequential failed attempts.</li>
                <li><strong>Validation:</strong> Strict Zod schemas mandate exact payloads, dropping unrecognized or malformed data before database insertion.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
