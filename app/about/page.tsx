import Link from 'next/link';
import { ArrowLeft, User, Github } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-12 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
        
        <div className="mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">About the Project</h1>
          <p className="text-xl text-muted-foreground">
            Vaultr is an open-source initiative aimed at making self-hosted secrets management accessible and visually refined.
          </p>
        </div>

        <div className="grid gap-12 md:grid-cols-2">
          {/* Origins */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Project Origins</h2>
            <p className="text-muted-foreground leading-relaxed">
              Vaultr was created to address a specific gap in the ecosystem: a lightweight, modern password manager that doesn&apos;t compromise on UI/UX while remaining fully transparent. Many existing solutions are either closed-source or heavily enterprise-focused. Vaultr is built for individuals and small teams who want to run their own infrastructure without sacrificing usability.
            </p>
          </section>

          {/* Philosophy */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Development Philosophy</h2>
            <p className="text-muted-foreground leading-relaxed">
              The project embraces standard web primitives. By leveraging Next.js, standard Web APIs, and straightforward database schemas, Vaultr ensures that its codebase remains auditable and resilient. We focus on continuous iteration, refining core features before layering on unnecessary complexity.
            </p>
          </section>
        </div>

        {/* Creator */}
        <section className="mt-16 bg-card border rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Maintained by Akshay Shukla</h3>
              <p className="text-muted-foreground mb-4">
                Software engineer and open-source contributor. Vaultr serves as a flagship project for modern frontend architecture and cryptography.
              </p>
              <div className="flex items-center gap-4">
                <a 
                  href="https://github.com/AkshayS734" 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  <Github className="mr-2 h-4 w-4" />
                  GitHub Profile
                </a>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
