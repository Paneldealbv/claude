import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer voor sessie en project. Elke pagina achter de login haalt
 * gebruiker en project hier op; de database controleert daarnaast zelf (RLS)
 * dat de gebruiker alleen eigen projectgegevens ziet.
 */

export type Rol = "eigenaar" | "bewerker" | "lezer";

export type Gebruiker = { id: string; email: string };

export type ProjectLidmaatschap = {
  id: string;
  naam: string;
  adres: string | null;
  oplevering: string | null;
  rol: Rol;
};

export const ACTIEF_PROJECT_COOKIE = "nb-project";

/** Ingelogde gebruiker (token gecontroleerd), anders naar de inlogpagina. */
export const getGebruiker = cache(async (): Promise<Gebruiker> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/inloggen");
  return { id: claims.sub, email: String(claims.email ?? "") };
});

/** Alle projecten waar de gebruiker lid van is. */
export const getProjecten = cache(async (): Promise<ProjectLidmaatschap[]> => {
  const gebruiker = await getGebruiker();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("role, projects (id, name, address, expected_completion)")
    .eq("user_id", gebruiker.id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Projecten ophalen mislukt: ${error.message}`);

  return (data ?? []).flatMap((rij) => {
    const p = rij.projects as unknown as {
      id: string;
      name: string;
      address: string | null;
      expected_completion: string | null;
    } | null;
    if (!p) return [];
    return [
      {
        id: p.id,
        naam: p.name,
        adres: p.address,
        oplevering: p.expected_completion,
        rol: rij.role as Rol,
      },
    ];
  });
});

/**
 * Het project waar de gebruiker nu in werkt. Zonder project gaat de
 * gebruiker naar de welkomstpagina om er een aan te maken.
 */
export const getActiefProject = cache(
  async (): Promise<ProjectLidmaatschap> => {
    const projecten = await getProjecten();
    if (projecten.length === 0) redirect("/welkom");
    const gekozen = (await cookies()).get(ACTIEF_PROJECT_COOKIE)?.value;
    return projecten.find((p) => p.id === gekozen) ?? projecten[0];
  },
);

export type Lid = {
  userId: string;
  naam: string;
  email: string;
  rol: Rol;
  sinds: string;
};

/** Leden van een project (alleen zichtbaar voor leden, via RLS). */
export async function getLeden(projectId: string): Promise<Lid[]> {
  const supabase = await createClient();
  const { data: leden, error } = await supabase
    .from("project_members")
    .select("user_id, role, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Leden ophalen mislukt: ${error.message}`);

  const ids = (leden ?? []).map((l) => l.user_id as string);
  const { data: profielen } = ids.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ids)
    : { data: [] };
  const perId = new Map(
    (profielen ?? []).map((p) => [p.id as string, p] as const),
  );

  return (leden ?? []).map((l) => {
    const p = perId.get(l.user_id as string);
    return {
      userId: l.user_id as string,
      naam: (p?.full_name as string) || (p?.email as string) || "Onbekend",
      email: (p?.email as string) ?? "",
      rol: l.role as Rol,
      sinds: l.created_at as string,
    };
  });
}

export function initialen(naam: string) {
  const delen = naam
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters =
    delen.length >= 2
      ? delen[0][0] + delen[1][0]
      : (delen[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}
