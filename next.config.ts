import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  httpAgentOptions: {
    keepAlive: true,
  },
  poweredByHeader: false,
  compress: true,

  serverExternalPackages: ["@prisma/client"],
  
  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          // Security headers
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // CSP - Content Security Policy
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;


