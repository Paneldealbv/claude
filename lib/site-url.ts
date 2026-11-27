import "server-only";
import { headers } from "next/headers";

/**
 * Basisadres van de app voor links in e-mails (bevestigen, wachtwoord,
 * uitnodigingen). Instelbaar met NEXT_PUBLIC_SITE_URL; anders afgeleid van
 * het huidige verzoek. Supabase accepteert alleen adressen uit de
 * toegestane lijst (Redirect URLs).
 */
export async function siteUrl(): Promise<string> {
  const ingesteld = process.env.NEXT_PUBLIC_SITE_URL;
  if (ingesteld) return ingesteld.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Alleen interne paden als doorverwijzing toestaan (geen "//andere-site.nl"
 * of "https://…"), zodat een link nooit naar een vreemde site leidt.
 */
export function veiligPad(pad: unknown, standaard = "/dashboard"): string {
  if (typeof pad !== "string") return standaard;
  // Browsers negeren tabs en regeleinden in een URL ("/\t/site.nl" wordt
  // "//site.nl"); backslashes gelden als "/". Zulke paden nooit toestaan.
  if (/[\u0000-\u001f\u007f\\]/.test(pad)) return standaard;
  if (!pad.startsWith("/") || pad.startsWith("//")) return standaard;
  // Laatste controle: het pad moet op de eigen site blijven.
  try {
    const basis = "https://eigen.invalid";
    if (new URL(pad, basis).origin !== basis) return standaard;
  } catch {
    return standaard;
  }
  return pad;
}
