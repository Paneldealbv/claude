import type { MetadataRoute } from "next";

/** Installeerbare app (PWA): naam, iconen en hoe hij opent. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nieuwbouw Dashboard",
    short_name: "Nieuwbouw",
    description:
      "Budget, offertes, facturen, bonnen en financiering van onze nieuwbouwwoning.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "nl",
    dir: "ltr",
    background_color: "#f6f5f1",
    theme_color: "#0f1a16",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Bon fotograferen", url: "/te-controleren/nieuw?bron=camera" },
      { name: "Factuur uploaden", url: "/te-controleren/nieuw" },
      { name: "Te controleren", url: "/te-controleren" },
    ],
  };
}
