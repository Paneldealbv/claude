import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { veiligPad } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

/**
 * Landingsadres van de links in e-mails (account bevestigen, wachtwoord
 * herstellen). Zet de sessie en stuurt door naar de gevraagde pagina.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const volgende = veiligPad(searchParams.get("volgende"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let gelukt = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    gelukt = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    gelukt = !error;
  }

  const doel = request.nextUrl.clone();
  doel.search = "";
  if (gelukt) {
    const [pad, query] = volgende.split("?");
    doel.pathname = pad;
    if (query) doel.search = `?${query}`;
    if (type === "signup" || type === "email") {
      doel.searchParams.set("bevestigd", "1");
    }
  } else {
    doel.pathname = "/inloggen";
    doel.searchParams.set("fout", "link");
  }
  return NextResponse.redirect(doel);
}
