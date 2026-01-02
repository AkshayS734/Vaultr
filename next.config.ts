import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  httpAgentOptions: {
    keepAlive: true,
  },
  poweredByHeader: false,
  compress: true,

  serverExternalPackages: ["@prisma/client"],
  
  headers: async () => {
    const isProd = process.env.NODE_ENV === "production";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
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
            value: isProd
              ? [
                  "default-src 'self'",
                  "base-uri 'self'",
                  "form-action 'self'",
                  "frame-ancestors 'none'",
                  "object-src 'none'",
                  "script-src 'self'",
                  "style-src 'self' 'unsafe-inline'",
                  "img-src 'self' data: https:",
                  "font-src 'self' data:",
                  `connect-src 'self' ${process.env.NEXT_PUBLIC_API_ORIGIN || ""}`,
                ].join('; ')
              : [
                  // Dev: loosen to allow Next.js HMR/inline runtime
                  "default-src 'self'",
                  "base-uri 'self'",
                  "form-action 'self'",
                  "frame-ancestors 'none'",
                  "object-src 'none'",
                  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
                  "style-src 'self' 'unsafe-inline'",
                  "img-src 'self' data: https:",
                  "font-src 'self' data:",
                  "connect-src 'self' ws: wss:",
                ].join('; '),
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: frontendUrl,
          },
          {
            key: "Vary",
            value: "Origin",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, x-csrf-token",
          },
        ],
      },
    ];
  },
};

export default nextConfig;


