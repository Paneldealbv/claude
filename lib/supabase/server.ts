import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sessieCookieOpties, supabaseEnv } from "./env";

/**
 * Supabase-client voor Server Components, Server Actions en Route Handlers.
 * Werkt namens de ingelogde gebruiker, dus alle Row Level Security geldt.
 */
export async function createClient() {
  // Eerst cookies() lezen: daarmee weet Next.js dat de pagina per verzoek
  // wordt opgebouwd (nooit vooraf met andermans gegevens).
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookieOptions: sessieCookieOpties,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, ...sessieCookieOpties }),
          );
        } catch {
          // Aangeroepen vanuit een Server Component: cookies kunnen daar niet
          // worden gezet. De proxy ververst de sessie al bij elk verzoek.
        }
      },
    },
  });
}
