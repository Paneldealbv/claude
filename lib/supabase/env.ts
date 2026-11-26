/**
 * Supabase-instellingen uit environment variables. Er staan nooit sleutels in
 * de code; lokaal komen ze uit .env.local, online uit de Vercel-instellingen.
 *
 * De publishable key is bedoeld voor gebruik in de browser: de beveiliging
 * zit in de Row Level Security van de database. De secret key gebruikt de
 * app niet.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is niet ingesteld: vul NEXT_PUBLIC_SUPABASE_URL en " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in (zie .env.example).",
    );
  }
  if (key.startsWith("sb_secret_")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY bevat een secret key. Gebruik de publishable key.",
    );
  }
  return { url, key };
}

/**
 * Sessiecookies: niet leesbaar voor JavaScript in de browser (httpOnly), alleen
 * via HTTPS (secure, behalve lokaal) en niet meegestuurd vanaf andere sites.
 * De app gebruikt de sessie uitsluitend op de server.
 */
export const sessieCookieOpties = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
