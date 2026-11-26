import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getActiefProject, getGebruiker } from "@/lib/auth";
import { isBtwTarief, vanafInclusief, type BtwTarief } from "@/lib/btw";
import { isGeldigeIsoDatum } from "@/lib/datum";
import type { Database } from "@/lib/supabase/database.types";

/** Gedeelde hulpjes voor de serveracties (geen acties zelf). */

export type Db = SupabaseClient<Database>;

export const tekst = (formData: FormData, naam: string) =>
  String(formData.get(naam) ?? "").trim();

/** Actief project, met een melding als de gebruiker alleen mag lezen. */
export async function bewerkbaarProject() {
  const gebruiker = await getGebruiker();
  const project = await getActiefProject();
  return {
    gebruiker,
    project,
    fout:
      project.rol === "lezer"
        ? "Je hebt alleen leesrechten in dit project."
        : null,
  };
}

export const datumOfLeeg = z
  .string()
  .refine((w) => w === "" || isGeldigeIsoDatum(w), {
    error: "Vul een geldige datum in als DD-MM-JJJJ.",
  });

/** Regels uit de RegelsEditor (JSON in één formulierveld). */
export function leesRegels(
  waarde: string,
  { categorieVerplicht }: { categorieVerplicht: boolean },
):
  | {
      regels: {
        omschrijving: string;
        categorieId: string | null;
        bedrag: number;
        btw: BtwTarief;
      }[];
    }
  | { fout: string } {
  let ruw: unknown;
  try {
    ruw = JSON.parse(waarde || "[]");
  } catch {
    return { fout: "De regels konden niet worden gelezen." };
  }
  const schema = z
    .array(
      z.object({
        omschrijving: z.string().max(300),
        categorieId: z.string().uuid().nullable(),
        bedrag: z.number().int().nullable(),
        btw: z.number(),
      }),
    )
    .max(200);
  const invoer = schema.safeParse(ruw);
  if (!invoer.success) return { fout: "De regels konden niet worden gelezen." };

  // Volledig lege regels negeren.
  const regels = invoer.data.filter(
    (r) => r.omschrijving !== "" || r.categorieId !== null || r.bedrag !== null,
  );
  if (!regels.length)
    return { fout: "Voeg minstens één regel met een bedrag toe." };
  for (const [i, r] of regels.entries()) {
    if (r.bedrag === null)
      return { fout: `Vul bij regel ${i + 1} een geldig bedrag in.` };
    if (!isBtwTarief(r.btw))
      return { fout: `Kies bij regel ${i + 1} een BTW-tarief.` };
    if (categorieVerplicht && !r.categorieId) {
      return { fout: `Kies bij regel ${i + 1} een categorie.` };
    }
  }
  return {
    regels: regels.map((r) => ({
      omschrijving: r.omschrijving,
      categorieId: r.categorieId,
      bedrag: r.bedrag as number,
      btw: r.btw as BtwTarief,
    })),
  };
}

/** Kolommen voor een bedrag inclusief BTW (excl. en BTW worden berekend). */
export function bedragKolommen(bedragIncl: number, btw: BtwTarief) {
  const { excl, btw: btwBedrag, incl } = vanafInclusief(bedragIncl, btw);
  return {
    amount_excl_cents: excl,
    vat_rate_bp: btw,
    vat_cents: btwBedrag,
    amount_incl_cents: incl,
  };
}

/**
 * Bepaalt de leverancier uit het formulier: een bestaande, een nieuwe (alleen
 * naam) of geen.
 */
export async function leverancierBepalen(
  supabase: Db,
  projectId: string,
  formData: FormData,
): Promise<{ id: string | null } | { fout: string }> {
  const nieuw = tekst(formData, "nieuweLeverancier");
  const gekozen = tekst(formData, "leverancierId");
  if (gekozen === "__nieuw__") {
    if (!nieuw) return { fout: "Vul de naam van de nieuwe leverancier in." };
    if (nieuw.length > 120)
      return { fout: "De naam van de leverancier is te lang." };
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ project_id: projectId, name: nieuw })
      .select("id")
      .single();
    if (error || !data)
      return { fout: "De leverancier kon niet worden aangemaakt." };
    return { id: data.id };
  }
  return { id: gekozen || null };
}

export function eersteFouten(error: z.ZodError) {
  const uit: Record<string, string> = {};
  for (const i of error.issues) uit[String(i.path[0] ?? "")] ??= i.message;
  return uit;
}
