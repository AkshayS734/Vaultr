import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://vaultr.akshayshukla.xyz";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],

        disallow: [
          "/api/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/unlock",
          "/dashboard",
          "/secrets",
          "/vault",
          "/settings",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}