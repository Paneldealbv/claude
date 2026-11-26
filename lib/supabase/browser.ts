"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Supabase-client voor de browser, ALLEEN voor uploads via een eenmalige
 * upload-URL. De sessie blijft in httpOnly-cookies op de server; deze client
 * heeft geen sessie en kan dus niets lezen of wijzigen in de database.
 */
let client: ReturnType<typeof createClient> | null = null;

export function uploadClient() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return client;
}
