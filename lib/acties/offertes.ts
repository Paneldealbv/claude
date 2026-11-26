"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbFout } from "./fouten";
import {
  bedragKolommen,
  bewerkbaarProject,
  datumOfLeeg,
  eersteFouten,
  leesRegels,
  leverancierBepalen,
  tekst,
  type Db,
} from "./hulp";
import type { ActieStatus } from "./project";

/*
 * Offertes zijn informatief: ze tellen nooit mee in de berekeningen. Pas bij
 * accepteren ontstaat een contract met dezelfde regels.
 */

function vernieuw() {
  revalidatePath("/offertes", "layout");
  revalidatePath("/contracten", "layout");
  revalidatePath("/leveranciers", "layout");
  revalidatePath("/budget", "layout");
}

const kopSchema = z.object({
  titel: z.string().min(1, { error: "Geef de offerte een titel." }).max(200),
  nummer: z.string().max(60, { error: "Maximaal 60 tekens." }),
  datum: datumOfLeeg,
  geldigTot: datumOfLeeg,
  notities: z.string().max(2000, { error: "Maximaal 2000 tekens." }),
  bestandId: z.string().uuid().or(z.literal("")),
});

/** Verwijdert een bestand als niets er meer naar verwijst. */
async function ruimBestandOp(
  supabase: Db,
  projectId: string,
  bestandId: string | null,
) {
  if (!bestandId) return;
  const tel = (tabel: "quotes" | "cost_documents" | "document_extractions") =>
    supabase
      .from(tabel)
      .select("id", { count: "exact", head: true })
      .eq("file_id", bestandId);
  const [a, b, c] = await Promise.all([
    tel("quotes"),
    tel("cost_documents"),
    tel("document_extractions"),
  ]);
  if ((a.count ?? 0) + (b.count ?? 0) + (c.count ?? 0) > 0) return;
  const { data: f } = await supabase
    .from("files")
    .select("storage_path")
    .eq("project_id", projectId)
    .eq("id", bestandId)
    .maybeSingle();
  if (!f) return;
  await supabase.storage.from("documenten").remove([f.storage_path]);
  await supabase
    .from("files")
    .delete()
    .eq("project_id", projectId)
    .eq("id", bestandId);
}

// -----------------------------------------------------------------------------
export async function offerteOpslaan(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const waarden = {
    titel: tekst(formData, "titel"),
    nummer: tekst(formData, "nummer"),
    datum: tekst(formData, "datum"),
    geldigTot: tekst(formData, "geldigTot"),
    notities: tekst(formData, "notities"),
    bestandId: tekst(formData, "bestandId"),
  };
  const kop = kopSchema.safeParse(waarden);
  if (!kop.success)
    return {
      veldfouten: eersteFouten(kop.error),
      fout: "Controleer de gemarkeerde velden.",
    };
  const regels = leesRegels(tekst(formData, "regels"), {
    categorieVerplicht: false,
  });
  if ("fout" in regels) return { fout: regels.fout };

  const id = tekst(formData, "id");
  const supabase = await createClient();

  let vorigBestand: string | null = null;
  if (id) {
    const { data: bestaand } = await supabase
      .from("quotes")
      .select("status, file_id")
      .eq("project_id", project.id)
      .eq("id", id)
      .maybeSingle();
    if (!bestaand) return { fout: "Offerte niet gevonden." };
    if (bestaand.status === "geaccepteerd") {
      return {
        fout: "Een geaccepteerde offerte kun je niet meer wijzigen; wijzig het contract.",
      };
    }
    vorigBestand = bestaand.file_id;
  }

  const leverancier = await leverancierBepalen(supabase, project.id, formData);
  if ("fout" in leverancier) {
    return {
      fout: "Controleer de gemarkeerde velden.",
      veldfouten: { nieuweLeverancier: leverancier.fout },
    };
  }

  const rij = {
    supplier_id: leverancier.id,
    title: kop.data.titel,
    quote_number: kop.data.nummer || null,
    quote_date: kop.data.datum || null,
    valid_until: kop.data.geldigTot || null,
    notes: kop.data.notities || null,
    file_id: kop.data.bestandId || null,
  };

  let offerteId = id;
  if (id) {
    const { error } = await supabase
      .from("quotes")
      .update(rij)
      .eq("project_id", project.id)
      .eq("id", id);
    if (error) return { fout: dbFout(error) };
    const { error: wisFout } = await supabase
      .from("quote_lines")
      .delete()
      .eq("quote_id", id);
    if (wisFout) return { fout: dbFout(wisFout) };
  } else {
    const { data, error } = await supabase
      .from("quotes")
      .insert({ ...rij, project_id: project.id })
      .select("id")
      .single();
    if (error || !data) return { fout: dbFout(error) };
    offerteId = data.id;
  }

  const { error: regelFout } = await supabase.from("quote_lines").insert(
    regels.regels.map((r, i) => ({
      project_id: project.id,
      quote_id: offerteId,
      category_id: r.categorieId,
      description: r.omschrijving,
      sort_order: i + 1,
      ...bedragKolommen(r.bedrag, r.btw),
    })),
  );
  if (regelFout) {
    // Nieuwe offerte zonder regels niet laten staan.
    if (!id)
      await supabase
        .from("quotes")
        .delete()
        .eq("project_id", project.id)
        .eq("id", offerteId);
    return { fout: dbFout(regelFout) };
  }

  if (vorigBestand && vorigBestand !== rij.file_id)
    await ruimBestandOp(supabase, project.id, vorigBestand);
  vernieuw();
  redirect(`/offertes/${offerteId}`);
}

// -----------------------------------------------------------------------------
export async function offerteStatusWijzigen(formData: FormData): Promise<void> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return;
  const status = z
    .enum(["ontvangen", "afgewezen", "verlopen"])
    .safeParse(tekst(formData, "status"));
  if (!status.success) return;
  const supabase = await createClient();
  await supabase
    .from("quotes")
    .update({ status: status.data })
    .eq("project_id", project.id)
    .eq("id", tekst(formData, "id"))
    .neq("status", "geaccepteerd");
  vernieuw();
}

// -----------------------------------------------------------------------------
export async function offerteAccepteren(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const id = tekst(formData, "id");
  const invoer = z
    .object({
      titel: z
        .string()
        .min(1, { error: "Geef het contract een titel." })
        .max(200),
      getekendOp: datumOfLeeg,
    })
    .safeParse({
      titel: tekst(formData, "titel"),
      getekendOp: tekst(formData, "getekendOp"),
    });
  if (!invoer.success) return { veldfouten: eersteFouten(invoer.error) };

  const supabase = await createClient();
  const { data: offerte } = await supabase
    .from("quotes")
    .select(
      "id, status, supplier_id, quote_lines (description, category_id, amount_excl_cents, vat_rate_bp, vat_cents, amount_incl_cents, sort_order)",
    )
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!offerte) return { fout: "Offerte niet gevonden." };
  if (offerte.status === "geaccepteerd")
    return { fout: "Deze offerte is al geaccepteerd." };
  const regels = offerte.quote_lines ?? [];
  if (!regels.length) return { fout: "Deze offerte heeft geen regels." };
  if (regels.some((r) => !r.category_id)) {
    return {
      fout: "Geef eerst elke regel een categorie (via Bewerken). Een contract telt mee in het budget per categorie.",
    };
  }

  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({
      project_id: project.id,
      supplier_id: offerte.supplier_id,
      quote_id: offerte.id,
      title: invoer.data.titel,
      signed_on: invoer.data.getekendOp || null,
      status: "actief",
    })
    .select("id")
    .single();
  if (error || !contract) return { fout: dbFout(error) };

  const { error: regelFout } = await supabase.from("contract_lines").insert(
    [...regels]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r, i) => ({
        project_id: project.id,
        contract_id: contract.id,
        category_id: r.category_id as string,
        description: r.description,
        sort_order: i + 1,
        amount_excl_cents: r.amount_excl_cents,
        vat_rate_bp: r.vat_rate_bp,
        vat_cents: r.vat_cents,
        amount_incl_cents: r.amount_incl_cents,
      })),
  );
  if (regelFout) {
    await supabase
      .from("contracts")
      .delete()
      .eq("project_id", project.id)
      .eq("id", contract.id);
    return { fout: dbFout(regelFout) };
  }

  await supabase
    .from("quotes")
    .update({ status: "geaccepteerd" })
    .eq("project_id", project.id)
    .eq("id", offerte.id);
  await supabase.from("activity_log").insert({
    project_id: project.id,
    action: "offerte_geaccepteerd",
    table_name: "quotes",
    record_id: offerte.id,
    changes: { contract_id: contract.id },
  });
  vernieuw();
  redirect(`/contracten/${contract.id}`);
}

// -----------------------------------------------------------------------------
export async function offerteVerwijderen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  if (tekst(formData, "bevestig") !== "ja")
    return { fout: "Vink aan dat je de offerte wilt verwijderen." };
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { data: offerte } = await supabase
    .from("quotes")
    .select("status, file_id")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!offerte) return { fout: "Offerte niet gevonden." };
  if (offerte.status === "geaccepteerd") {
    return {
      fout: "Een geaccepteerde offerte hoort bij een contract en blijft bewaard.",
    };
  }
  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("project_id", project.id)
    .eq("id", id);
  if (error) return { fout: dbFout(error) };
  await ruimBestandOp(supabase, project.id, offerte.file_id);
  vernieuw();
  redirect("/offertes");
}
