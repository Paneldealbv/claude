import type { NextConfig } from "next";

/**
 * Cache Components staat uit: alle schermen staan achter een login en tonen
 * financiële gegevens die altijd actueel moeten zijn. Elke pagina wordt per
 * verzoek op de server opgebouwd met de sessie van de gebruiker.
 */
const securityHeaders = [
  // Niet in een iframe van een andere site te tonen (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera alleen voor deze site (bonnen fotograferen, latere fase).
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
