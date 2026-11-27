import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, maakNonce } from "@/lib/csp";
import { sessieCookieOpties, supabaseEnv } from "./env";

/** Pagina's die zonder inloggen bereikbaar zijn. */
const OPENBAAR = [
  "/inloggen",
  "/registreren",
  "/wachtwoord-vergeten",
  "/auth/",
  "/uitnodiging/",
];
/** Pagina's waar een ingelogde gebruiker niets te zoeken heeft. */
const ALLEEN_UITGELOGD = ["/inloggen", "/registreren", "/wachtwoord-vergeten"];

const begintMet = (pad: string, lijst: string[]) =>
  lijst.some((p) => (p.endsWith("/") ? pad.startsWith(p) : pad === p));

/**
 * Ververst bij elk verzoek de sessie (vernieuwt het token als dat bijna
 * verloopt) en stuurt niet-ingelogde bezoekers naar de inlogpagina.
 * Dit is een snelle eerste controle; de echte beveiliging zit in de
 * database (RLS) en in de controle op elke pagina.
 */
export async function updateSession(request: NextRequest) {
  const { url, key } = supabaseEnv();

  // Content Security Policy met een nieuwe nonce per verzoek. Next.js leest
  // de nonce uit de header van het verzoek en zet hem op zijn eigen scripts.
  const nonce = maakNonce();
  const csp = contentSecurityPolicy(nonce, {
    supabaseUrl: url,
    https: request.nextUrl.protocol === "https:",
    dev: process.env.NODE_ENV === "development",
  });
  // Bij elke (nieuwe) response de actuele cookies van het verzoek meesturen.
  const volgende = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    const r = NextResponse.next({ request: { headers } });
    r.headers.set("Content-Security-Policy", csp);
    return r;
  };
  let response = volgende();

  const supabase = createServerClient<Database>(url, key, {
    cookieOptions: sessieCookieOpties,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = volgende();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...options,
            ...sessieCookieOpties,
          }),
        );
      },
    },
  });

  // getClaims() controleert de handtekening van het token; nooit alleen op
  // de cookie-inhoud vertrouwen.
  const { data } = await supabase.auth.getClaims();
  const ingelogd = Boolean(data?.claims?.sub);
  const pad = request.nextUrl.pathname;

  if (!ingelogd && !begintMet(pad, OPENBAAR)) {
    const doel = request.nextUrl.clone();
    doel.pathname = "/inloggen";
    doel.search = "";
    if (pad !== "/" && pad !== "/dashboard") {
      doel.searchParams.set("volgende", pad + request.nextUrl.search);
    }
    return kopieerCookies(response, NextResponse.redirect(doel));
  }

  if (ingelogd && begintMet(pad, ALLEEN_UITGELOGD)) {
    const doel = request.nextUrl.clone();
    doel.pathname = "/dashboard";
    doel.search = "";
    return kopieerCookies(response, NextResponse.redirect(doel));
  }

  return response;
}

/** Vernieuwde sessiecookies ook meesturen bij een doorverwijzing. */
function kopieerCookies(van: NextResponse, naar: NextResponse) {
  van.cookies.getAll().forEach((c) => naar.cookies.set(c));
  return naar;
}
