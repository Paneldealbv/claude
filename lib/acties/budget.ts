"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActiefProject, getGebruiker } from "@/lib/auth";
import { isBtwTarief, vanafInclusief } from "@/lib/btw";
import { laadProjectInvoer } from "@/lib/data/project";
import { vandaagIso } from "@/lib/datum";
import { controleerAfsluiten } from "@/lib/finance";
import { STANDAARD_CATEGORIEEN } from "@/lib/standaard-indeling";
import { createClient } from "@/lib/supabase/server";
import { dbFout } from "./fouten";
import type { ActieStatus } from "./project";

/*
 * Acties voor categorieën en budgetregels. De database controleert zelf
 * (RLS) of de gebruiker mag wijzigen; de controles hier zorgen voor
 * duidelijke meldingen.
 */

const tekst = (formData: FormData, naam: string) =>
  String(formData.get(naam) ?? "");

async function bewerkbaarProject() {
  await getGebruiker();
  const project = await getActiefProject();
  if (project.rol === "lezer") {
    return {
      project,
      fout: "Je hebt alleen leesrechten in dit project.",
    } as const;
  }
  return { project, fout: null } as const;
}

function vernieuw() {
  revalidatePath("/budget", "layout");
  revalidatePath("/dashboard");
}

const naamSchema = z
  .string()
  .trim()
  .min(1, { error: "Geef de categorie een naam." })
  .max(80, { error: "Maximaal 80 tekens." });

// -----------------------------------------------------------------------------
// Standaardindeling
// -----------------------------------------------------------------------------
export async function standaardIndelingToevoegen(): Promise<void> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return;
  const supabase = await createClient();

  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id);
  if ((count ?? 0) > 0) return; // alleen voor een leeg project

  const { data: hoofden, error } = await supabase
    .from("categories")
    .insert(
      STANDAARD_CATEGORIEEN.map((c, i) => ({
        project_id: project.id,
        name: c.naam,
        sort_order: i + 1,
      })),
    )
    .select("id, name");
  if (error || !hoofden) throw new Error(dbFout(error));

  const idPerNaam = new Map(hoofden.map((h) => [h.name, h.id]));
  const { error: fout2 } = await supabase.from("categories").insert(
    STANDAARD_CATEGORIEEN.flatMap((c) =>
      c.kinderen.map((naam, i) => ({
        project_id: project.id,
        parent_id: idPerNaam.get(c.naam) ?? null,
        name: naam,
        sort_order: i + 1,
      })),
    ),
  );
  if (fout2) throw new Error(dbFout(fout2));
  vernieuw();
}

// -----------------------------------------------------------------------------
// Categorie toevoegen, hernoemen, verplaatsen, verwijderen
// -----------------------------------------------------------------------------
export async function categorieToevoegen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const naam = naamSchema.safeParse(formData.get("naam"));
  const parentId = tekst(formData, "parentId") || null;
  if (!naam.success) {
    return {
      veldfouten: { naam: naam.error.issues[0].message },
      waarden: { naam: tekst(formData, "naam") },
    };
  }

  const supabase = await createClient();
  let volgorde = supabase
    .from("categories")
    .select("sort_order")
    .eq("project_id", project.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  volgorde = parentId
    ? volgorde.eq("parent_id", parentId)
    : volgorde.is("parent_id", null);
  const { data: laatste } = await volgorde;

  const { error } = await supabase.from("categories").insert({
    project_id: project.id,
    parent_id: parentId,
    name: naam.data,
    sort_order: (laatste?.[0]?.sort_order ?? 0) + 1,
  });
  if (error) return { fout: dbFout(error), waarden: { naam: naam.data } };

  vernieuw();
  return { succes: `Categorie "${naam.data}" toegevoegd.` };
}

export async function categorieHernoemen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const naam = naamSchema.safeParse(formData.get("naam"));
  if (!naam.success)
    return { veldfouten: { naam: naam.error.issues[0].message } };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: naam.data })
    .eq("project_id", project.id)
    .eq("id", tekst(formData, "id"));
  if (error) return { fout: dbFout(error) };
  vernieuw();
  return { succes: "Naam opgeslagen." };
}

export async function categorieVerplaatsen(formData: FormData): Promise<void> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return;
  const id = tekst(formData, "id");
  const omhoog = tekst(formData, "richting") === "omhoog";
  const supabase = await createClient();

  const { data: huidige } = await supabase
    .from("categories")
    .select("parent_id")
    .eq("project_id", project.id)
    .eq("id", id)
    .single();
  if (!huidige) return;

  let query = supabase
    .from("categories")
    .select("id, sort_order, name")
    .eq("project_id", project.id);
  query = huidige.parent_id
    ? query.eq("parent_id", huidige.parent_id)
    : query.is("parent_id", null);
  const { data: broers } = await query
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (!broers) return;

  const index = broers.findIndex((b) => b.id === id);
  const doel = omhoog ? index - 1 : index + 1;
  if (index < 0 || doel < 0 || doel >= broers.length) return;
  [broers[index], broers[doel]] = [broers[doel], broers[index]];

  // Volgorde opnieuw nummeren (1, 2, 3 …) en alleen wijzigingen opslaan.
  await Promise.all(
    broers.map((b, i) =>
      b.sort_order === i + 1
        ? null
        : supabase
            .from("categories")
            .update({ sort_order: i + 1 })
            .eq("project_id", project.id)
            .eq("id", b.id),
    ),
  );
  vernieuw();
}

export async function categorieVerwijderen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  if (tekst(formData, "bevestig") !== "ja") {
    return { fout: "Vink aan dat je de categorie wilt verwijderen." };
  }
  const id = tekst(formData, "id");
  const supabase = await createClient();

  const [cat, kinderen, contractRegels, kostenRegels, offerteRegels] =
    await Promise.all([
      supabase.from("categories").select("parent_id").eq("id", id).single(),
      supabase
        .from("categories")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", id),
      supabase
        .from("contract_lines")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id),
      supabase
        .from("cost_lines")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id),
      supabase
        .from("quote_lines")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id),
    ]);
  if (!cat.data) return { fout: "Categorie niet gevonden." };
  if ((kinderen.count ?? 0) > 0) {
    return { fout: "Verwijder of verplaats eerst de subcategorieën." };
  }
  if (
    (contractRegels.count ?? 0) +
      (kostenRegels.count ?? 0) +
      (offerteRegels.count ?? 0) >
    0
  ) {
    return {
      fout: "Aan deze categorie zijn offertes, contracten of kosten gekoppeld. Koppel die eerst aan een andere categorie.",
    };
  }

  const { error: budgetFout } = await supabase
    .from("budget_lines")
    .delete()
    .eq("project_id", project.id)
    .eq("category_id", id);
  if (budgetFout) return { fout: dbFout(budgetFout) };
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { fout: dbFout(error) };

  vernieuw();
  redirect(cat.data.parent_id ? `/budget/${cat.data.parent_id}` : "/budget");
}

// -----------------------------------------------------------------------------
// Budgetregels
// -----------------------------------------------------------------------------
export async function budgetRegelOpslaan(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const waarden = {
    omschrijving: tekst(formData, "omschrijving"),
    bedrag: tekst(formData, "bedrag"),
    btw: tekst(formData, "btw"),
  };
  const invoer = z
    .object({
      omschrijving: z
        .string()
        .trim()
        .max(200, { error: "Maximaal 200 tekens." }),
      bedrag: z
        .string()
        .regex(/^\d+$/, { error: "Vul een bedrag in, bijvoorbeeld 1.250,00." })
        .transform(Number)
        .refine(Number.isSafeInteger, { error: "Bedrag is te groot." }),
      btw: z.coerce
        .number()
        .refine(isBtwTarief, { error: "Kies een BTW-tarief." }),
    })
    .safeParse(waarden);
  if (!invoer.success) {
    const veldfouten: Record<string, string> = {};
    for (const i of invoer.error.issues)
      veldfouten[String(i.path[0])] ??= i.message;
    return { veldfouten, waarden };
  }

  const { excl, btw, incl } = vanafInclusief(
    invoer.data.bedrag,
    invoer.data.btw as Parameters<typeof vanafInclusief>[1],
  );
  const rij = {
    description: invoer.data.omschrijving,
    amount_excl_cents: excl,
    vat_rate_bp: invoer.data.btw,
    vat_cents: btw,
    amount_incl_cents: incl,
  };
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("budget_lines").update(rij).eq("id", id)
    : await supabase.from("budget_lines").insert({
        ...rij,
        project_id: project.id,
        category_id: tekst(formData, "categorieId"),
      });
  if (error) return { fout: dbFout(error), waarden };

  vernieuw();
  return { succes: id ? "Budgetregel bijgewerkt." : "Budgetregel toegevoegd." };
}

export async function budgetRegelVerwijderen(
  formData: FormData,
): Promise<void> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return;
  const supabase = await createClient();
  await supabase
    .from("budget_lines")
    .delete()
    .eq("project_id", project.id)
    .eq("id", tekst(formData, "id"));
  vernieuw();
}

// -----------------------------------------------------------------------------
// Afsluiten en heropenen
// -----------------------------------------------------------------------------
export async function categorieAfsluiten(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const id = tekst(formData, "id");

  // Altijd opnieuw controleren met de actuele gegevens.
  const invoer = await laadProjectInvoer(project.id);
  if (!invoer.categorieen.some((c) => c.id === id))
    return { fout: "Categorie niet gevonden." };
  const controle = controleerAfsluiten(invoer, id, { vandaag: vandaagIso() });
  if (!controle.kanDirectAfsluiten && tekst(formData, "bevestig") !== "ja") {
    return { fout: "Vink aan dat je de waarschuwingen hebt gelezen." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_closed: true })
    .eq("id", id);
  if (error) return { fout: dbFout(error) };

  await supabase.from("activity_log").insert({
    project_id: project.id,
    action: "categorie_afgesloten",
    table_name: "categories",
    record_id: id,
    changes: {
      waarschuwingen_bevestigd: controle.waarschuwingen.map((w) => w.tekst),
      prognose_voor: controle.prognoseNu,
      prognose_na: controle.prognoseNaAfsluiten,
    },
  });

  vernieuw();
  return { succes: "Categorie afgesloten." };
}

export async function categorieHeropenen(formData: FormData): Promise<void> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return;
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_closed: false })
    .eq("id", id);
  if (!error) {
    await supabase.from("activity_log").insert({
      project_id: project.id,
      action: "categorie_heropend",
      table_name: "categories",
      record_id: id,
    });
  }
  vernieuw();
}
