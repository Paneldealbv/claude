import type { MetadataRoute } from "next";

/** Privé app: niet laten indexeren door zoekmachines. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
