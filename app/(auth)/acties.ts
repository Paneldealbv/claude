"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIEF_PROJECT_COOKIE } from "@/lib/auth";
import { vertaalAuthFout } from "@/lib/auth-fouten";
import { siteUrl, veiligPad } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export type FormStatus = {
  fout?: string;
  veldfouten?: Record<string, string>;
  succes?: string;
  waarden?: Record<string, string>;
};

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Vul een geldig e-mailadres in." }));

const wachtwoord = z
  .string()
  .min(10, { error: "Minimaal 10 tekens." })
  .max(72, { error: "Maximaal 72 tekens." });

function veldfouten(error: z.ZodError): Record<string, string> {
  const uit: Record<string, string> = {};
  for (const issue of error.issues) {
    const sleutel = String(issue.path[0] ?? "");
    uit[sleutel] ??= issue.message;
  }
  return uit;
}

// -----------------------------------------------------------------------------
export async function inloggen(
  _vorige: FormStatus,
  formData: FormData,
): Promise<FormStatus> {
  const invoer = z
    .object({
      email,
      wachtwoord: z.string().min(1, { error: "Vul je wachtwoord in." }),
    })
    .safeParse({
      email: formData.get("email"),
      wachtwoord: formData.get("wachtwoord"),
    });
  const waarden = { email: String(formData.get("email") ?? "") };
  if (!invoer.success) return { veldfouten: veldfouten(invoer.error), waarden };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: invoer.data.email,
    password: invoer.data.wachtwoord,
  });
  if (error) return { fout: vertaalAuthFout(error), waarden };

  redirect(veiligPad(formData.get("volgende")));
}

// -----------------------------------------------------------------------------
export async function registreren(
  _vorige: FormStatus,
  formData: FormData,
): Promise<FormStatus> {
  const invoer = z
    .object({
      naam: z.string().trim().min(1, { error: "Vul je naam in." }).max(120),
      email,
      wachtwoord,
      herhaal: z.string(),
    })
    .refine((d) => d.wachtwoord === d.herhaal, {
      path: ["herhaal"],
      error: "De wachtwoorden zijn niet gelijk.",
    })
    .safeParse({
      naam: formData.get("naam"),
      email: formData.get("email"),
      wachtwoord: formData.get("wachtwoord"),
      herhaal: formData.get("herhaal"),
    });
  const waarden = {
    naam: String(formData.get("naam") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  if (!invoer.success) return { veldfouten: veldfouten(invoer.error), waarden };

  const volgende = veiligPad(formData.get("volgende"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: invoer.data.email,
    password: invoer.data.wachtwoord,
    options: {
      data: { full_name: invoer.data.naam },
      emailRedirectTo: `${await siteUrl()}/auth/bevestigen?volgende=${encodeURIComponent(volgende)}`,
    },
  });
  if (error) return { fout: vertaalAuthFout(error), waarden };

  // Als e-mailbevestiging uit staat, is de gebruiker direct ingelogd.
  if (data.session) redirect(volgende);

  return {
    succes: `We hebben een bevestigingsmail gestuurd naar ${invoer.data.email}. Klik op de link in die mail om je account te activeren.`,
  };
}

// -----------------------------------------------------------------------------
export async function wachtwoordVergeten(
  _vorige: FormStatus,
  formData: FormData,
): Promise<FormStatus> {
  const invoer = z
    .object({ email })
    .safeParse({ email: formData.get("email") });
  if (!invoer.success) {
    return {
      veldfouten: veldfouten(invoer.error),
      waarden: { email: String(formData.get("email") ?? "") },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    invoer.data.email,
    {
      redirectTo: `${await siteUrl()}/auth/bevestigen?volgende=/wachtwoord-herstellen`,
    },
  );
  if (error && error.code?.startsWith("over_")) {
    return { fout: vertaalAuthFout(error) };
  }

  // Altijd dezelfde melding: verraad niet of een adres een account heeft.
  return {
    succes:
      "Als er een account bij dit e-mailadres hoort, ontvang je binnen enkele minuten een mail met een link om een nieuw wachtwoord in te stellen.",
  };
}

// -----------------------------------------------------------------------------
export async function wachtwoordHerstellen(
  _vorige: FormStatus,
  formData: FormData,
): Promise<FormStatus> {
  const invoer = z
    .object({ wachtwoord, herhaal: z.string() })
    .refine((d) => d.wachtwoord === d.herhaal, {
      path: ["herhaal"],
      error: "De wachtwoorden zijn niet gelijk.",
    })
    .safeParse({
      wachtwoord: formData.get("wachtwoord"),
      herhaal: formData.get("herhaal"),
    });
  if (!invoer.success) return { veldfouten: veldfouten(invoer.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: invoer.data.wachtwoord,
  });
  if (error) return { fout: vertaalAuthFout(error) };

  return { succes: "Je wachtwoord is gewijzigd." };
}

// -----------------------------------------------------------------------------
export async function uitloggen() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ACTIEF_PROJECT_COOKIE);
  redirect("/inloggen");
}
