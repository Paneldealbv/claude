/**
 * Regels voor bestanden (offertes, facturen, bonnen). Gedeeld door browser en
 * server; dezelfde grenzen gelden ook in de database en de opslag (0003/0008).
 */
export const MAX_BESTAND_BYTES = 20 * 1024 * 1024; // 20 MB

export const TOEGESTANE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export const ACCEPT_ATTRIBUUT = Object.keys(TOEGESTANE_TYPES).join(",");

export function controleerBestand(
  type: string,
  grootte: number,
): string | null {
  if (!TOEGESTANE_TYPES[type]) {
    return "Alleen PDF's en foto's (JPG, PNG, WEBP, HEIC) zijn toegestaan.";
  }
  if (grootte <= 0) return "Het bestand is leeg.";
  if (grootte > MAX_BESTAND_BYTES) return "Het bestand is groter dan 20 MB.";
  return null;
}

export function formatBestandsgrootte(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} MB`;
}
