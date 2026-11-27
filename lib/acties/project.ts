"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ACTIEF_PROJECT_COOKIE,
  getActiefProject,
  getGebruiker,
  getProjecten,
} from "@/lib/auth";
import { isGeldigeIsoDatum } from "@/lib/datum";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { dbFout } from "./fouten";

/*
 * Alle acties controleren eerst wie er ingelogd is. De database controleert
 * daarna zelf (RLS en functies) of de gebruiker de actie mag uitvoeren; de
 * controles hier zijn er voor duidelijke meldingen.
 */

export type ActieStatus = {
  fout?: string;
  veldfouten?: Record<string, string>;
  succes?: string;
  link?: string;
  waarden?: Record<string, string>;
};

const ROLLEN = ["eigenaar", "bewerker", "lezer"] as const;
// Leeg, of een bestaande datum in ISO (het datumveld stuurt JJJJ-MM-DD).
const datum = z.string().refine((w) => w === "" || isGeldigeIsoDatum(w), {
  error: "Vul een geldige datum in als DD-MM-JJJJ.",
});

async function kiesProject(projectId: string) {
  (await cookies()).set(ACTIEF_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

function eersteFouten(error: z.ZodError) {
  const uit: Record<string, string> = {};
  for (const i of error.issues) uit[String(i.path[0] ?? "")] ??= i.message;
  return uit;
}

const tekst = (formData: FormData, naam: string) =>
  String(formData.get(naam) ?? "");

// -----------------------------------------------------------------------------
// Project aanmaken en wisselen
// -----------------------------------------------------------------------------
export async function projectAanmaken(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  await getGebruiker();
  const waarden = {
    naam: tekst(formData, "naam"),
    adres: tekst(formData, "adres"),
    oplevering: tekst(formData, "oplevering"),
  };
  const invoer = z
    .object({
      naam: z
        .string()
        .trim()
        .min(1, { error: "Geef het project een naam." })
        .max(120),
      adres: z.string().trim().max(200),
      oplevering: datum,
    })
    .safeParse(waarden);
  if (!invoer.success)
    return { veldfouten: eersteFouten(invoer.error), waarden };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_project", {
    p_name: invoer.data.naam,
    // Lege velden weglaten: de databasefunctie gebruikt dan null.
    p_address: invoer.data.adres || undefined,
    p_expected_completion: invoer.data.oplevering || undefined,
  });
  if (error || !data) return { fout: dbFout(error), waarden };

  await kiesProject(data as string);
  redirect("/dashboard");
}

export async function wisselProject(formData: FormData) {
  const id = tekst(formData, "projectId");
  const projecten = await getProjecten();
  if (projecten.some((p) => p.id === id)) await kiesProject(id);
  redirect("/dashboard");
}

// -----------------------------------------------------------------------------
// Uitnodigingen
// -----------------------------------------------------------------------------
export async function uitnodigen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const project = await getActiefProject();
  const waarden = {
    email: tekst(formData, "email"),
    rol: tekst(formData, "rol"),
  };
  if (project.rol !== "eigenaar") {
    return { fout: "Alleen een eigenaar kan iemand uitnodigen.", waarden };
  }
  const invoer = z
    .object({
      email: z
        .string()
        .trim()
        .toLowerCase()
        .pipe(z.email({ error: "Vul een geldig e-mailadres in." })),
      rol: z.enum(ROLLEN, { error: "Kies een rol." }),
    })
    .safeParse(waarden);
  if (!invoer.success)
    return { veldfouten: eersteFouten(invoer.error), waarden };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", {
    p_project: project.id,
    p_email: invoer.data.email,
    p_role: invoer.data.rol,
  });
  const rij = (Array.isArray(data) ? data[0] : data) as
    { token?: string } | null | undefined;
  if (error || !rij?.token) return { fout: dbFout(error), waarden };

  revalidatePath("/instellingen");
  return {
    succes: `De uitnodiging voor ${invoer.data.email} is klaar. Stuur deze link door; hij is 7 dagen geldig en werkt één keer.`,
    link: `${await siteUrl()}/uitnodiging/${rij.token}`,
  };
}

export async function uitnodigingIntrekken(formData: FormData) {
  await getGebruiker();
  const supabase = await createClient();
  await supabase.rpc("revoke_invite", {
    p_invite: tekst(formData, "inviteId"),
  });
  revalidatePath("/instellingen");
}

export async function uitnodigingAccepteren(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  await getGebruiker();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invite", {
    p_token: tekst(formData, "token"),
  });
  if (error || !data) return { fout: dbFout(error) };

  await kiesProject(data as string);
  redirect("/dashboard");
}

// -----------------------------------------------------------------------------
// Leden beheren (eigenaar)
// -----------------------------------------------------------------------------
export async function rolWijzigen(formData: FormData) {
  const project = await getActiefProject();
  const rol = z.enum(ROLLEN).safeParse(formData.get("rol"));
  if (!rol.success || project.rol !== "eigenaar") return;
  const supabase = await createClient();
  await supabase
    .from("project_members")
    .update({ role: rol.data })
    .eq("project_id", project.id)
    .eq("user_id", tekst(formData, "userId"));
  revalidatePath("/instellingen");
}

export async function lidVerwijderen(formData: FormData) {
  const project = await getActiefProject();
  const gebruiker = await getGebruiker();
  const userId = tekst(formData, "userId");
  const supabase = await createClient();
  await supabase
    .from("project_members")
    .delete()
    .eq("project_id", project.id)
    .eq("user_id", userId);
  if (userId === gebruiker.id) {
    (await cookies()).delete(ACTIEF_PROJECT_COOKIE);
    redirect("/dashboard");
  }
  revalidatePath("/instellingen");
}

// -----------------------------------------------------------------------------
// Profiel en projectgegevens
// -----------------------------------------------------------------------------
export async function profielOpslaan(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const gebruiker = await getGebruiker();
  const naam = z
    .string()
    .trim()
    .min(1, { error: "Vul je naam in." })
    .max(120)
    .safeParse(formData.get("naam"));
  if (!naam.success)
    return { veldfouten: { naam: naam.error.issues[0].message } };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: naam.data })
    .eq("id", gebruiker.id);
  if (error) return { fout: dbFout(error) };
  revalidatePath("/", "layout");
  return { succes: "Je naam is opgeslagen." };
}

export async function projectOpslaan(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const project = await getActiefProject();
  if (project.rol !== "eigenaar") {
    return { fout: "Alleen een eigenaar kan de projectgegevens wijzigen." };
  }
  const invoer = z
    .object({
      naam: z
        .string()
        .trim()
        .min(1, { error: "Geef het project een naam." })
        .max(120),
      adres: z.string().trim().max(200),
      oplevering: datum,
    })
    .safeParse({
      naam: tekst(formData, "naam"),
      adres: tekst(formData, "adres"),
      oplevering: tekst(formData, "oplevering"),
    });
  if (!invoer.success) return { veldfouten: eersteFouten(invoer.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name: invoer.data.naam,
      address: invoer.data.adres || null,
      expected_completion: invoer.data.oplevering || null,
    })
    .eq("id", project.id);
  if (error) return { fout: dbFout(error) };
  revalidatePath("/", "layout");
  return { succes: "Projectgegevens opgeslagen." };
}
