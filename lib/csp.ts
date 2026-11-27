/**
 * Content Security Policy (fase 10). Scripts alleen van de eigen site met de
 * nonce van dit verzoek ('strict-dynamic': wat die scripts laden mag ook).
 * Stijlen mogen inline (React-stijlattributen in grafieken en balken);
 * afbeeldingen, PDF's en uploads gaan naar de eigen Supabase-opslag.
 */
export function contentSecurityPolicy(
  nonce: string,
  {
    supabaseUrl,
    https,
    dev,
  }: { supabaseUrl: string; https: boolean; dev: boolean },
): string {
  const supabase = new URL(supabaseUrl).origin;
  const realtime = supabase.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase}`,
    "font-src 'self'",
    `connect-src 'self' ${supabase} ${realtime}`,
    `frame-src 'self' ${supabase}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** Willekeurige nonce per verzoek. */
export function maakNonce(): string {
  return btoa(crypto.randomUUID());
}
