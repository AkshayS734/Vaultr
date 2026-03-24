import Link from 'next/link';
import { ArrowLeft, MessageSquare, AlertTriangle, Bug } from 'lucide-react';
import { Card, CardContent } from '@/app/components/ui/card';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-12 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
        
        <div className="mb-16">
          <h1 className="text-4xl font-bold mb-4">Contact</h1>
          <p className="text-xl text-muted-foreground">
            Get in touch for general questions, bug reports, and security disclosures.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2">
          {/* General Inquiries */}
          <Card className="border">
            <CardContent className="p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">General Inquiries</h3>
              <p className="text-muted-foreground mb-6">
                For questions regarding self-hosting setups, project contributions, and general support.
              </p>
              <a href="mailto:akshaysbuilds@gmail.com" className="font-mono text-primary hover:underline">
                akshaysbuilds@gmail.com
              </a>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="border">
            <CardContent className="p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <AlertTriangle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Security Disclosures</h3>
              <p className="text-muted-foreground mb-6">
                If you have identified a critical vulnerability, please email us directly with a proof-of-concept.
              </p>
              <a href="mailto:akshaysbuilds@gmail.com" className="font-mono text-primary hover:underline">
                akshaysbuilds@gmail.com
              </a>
            </CardContent>
          </Card>

          {/* Issue Tracker */}
          <Card className="border md:col-span-2">
            <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <Bug className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold">GitHub Issue Tracker</h3>
                </div>
                <p className="text-muted-foreground max-w-xl">
                  For bug reports, feature requests, and non-sensitive code issues, please use the public issue tracker so the community can benefit from the discussion.
                </p>
              </div>
              <a 
                href="https://github.com/AkshayS734/Vaultr/issues" 
                target="_blank" 
                rel="noreferrer"
                className="whitespace-nowrap rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-6 py-2 flex items-center justify-center font-medium transition-colors"
              >
                Open an Issue
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
