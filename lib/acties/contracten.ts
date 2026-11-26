"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isBtwTarief } from "@/lib/btw";
import { verdeel } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";
import { dbFout } from "./fouten";
import {
  bedragKolommen,
  bewerkbaarProject,
  datumOfLeeg,
  eersteFouten,
  leesRegels,
  leverancierBepalen,
  logActie,
  tekst,
} from "./hulp";
import type { ActieStatus } from "./project";

/*
 * Contracten zijn de toezeggingslaag: ze tellen mee in de prognose.
 * Meer- en minderwerk telt pas mee na akkoord. Een termijnschema verdeelt
 * het contractbedrag over (verwachte) termijnfacturen; het telt zelf niet
 * extra mee, zodat er nooit dubbel wordt geteld.
 */

function vernieuw(contractId?: string) {
  revalidatePath("/contracten", "layout");
  revalidatePath("/offertes", "layout");
  revalidatePath("/leveranciers", "layout");
  revalidatePath("/budget", "layout");
  revalidatePath("/ruimtes");
  revalidatePath("/dashboard");
  if (contractId) revalidatePath(`/contracten/${contractId}`);
}

const kopSchema = z.object({
  titel: z.string().min(1, { error: "Geef het contract een naam." }).max(200),
  getekendOp: datumOfLeeg,
  notities: z.string().max(2000, { error: "Maximaal 2000 tekens." }),
});

// -----------------------------------------------------------------------------
// Contract
// -----------------------------------------------------------------------------

/** Contract zonder offerte (bijv. een mondelinge afspraak of opdrachtbon). */
export async function contractAanmaken(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const kop = kopSchema.safeParse({
    titel: tekst(formData, "titel"),
    getekendOp: tekst(formData, "getekendOp"),
    notities: tekst(formData, "notities"),
  });
  if (!kop.success) {
    return {
      veldfouten: eersteFouten(kop.error),
      fout: "Controleer de gemarkeerde velden.",
    };
  }
  const regels = leesRegels(tekst(formData, "regels"), {
    categorieVerplicht: true,
  });
  if ("fout" in regels) return { fout: regels.fout };

  const supabase = await createClient();
  const leverancier = await leverancierBepalen(supabase, project.id, formData);
  if ("fout" in leverancier) {
    return {
      fout: "Controleer de gemarkeerde velden.",
      veldfouten: { nieuweLeverancier: leverancier.fout },
    };
  }

  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({
      project_id: project.id,
      supplier_id: leverancier.id,
      title: kop.data.titel,
      signed_on: kop.data.getekendOp || null,
      notes: kop.data.notities || null,
      status: "actief",
    })
    .select("id")
    .single();
  if (error || !contract) return { fout: dbFout(error) };

  const { error: regelFout } = await supabase.from("contract_lines").insert(
    regels.regels.map((r, i) => ({
      project_id: project.id,
      contract_id: contract.id,
      category_id: r.categorieId as string,
      description: r.omschrijving,
      sort_order: i + 1,
      ...bedragKolommen(r.bedrag, r.btw),
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
  vernieuw();
  redirect(`/contracten/${contract.id}`);
}

export async function contractBijwerken(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const id = tekst(formData, "id");
  const kop = kopSchema.safeParse({
    titel: tekst(formData, "titel"),
    getekendOp: tekst(formData, "getekendOp"),
    notities: tekst(formData, "notities"),
  });
  if (!kop.success) return { veldfouten: eersteFouten(kop.error) };
  const supabase = await createClient();
  const leverancier = await leverancierBepalen(supabase, project.id, formData);
  if ("fout" in leverancier) {
    return { veldfouten: { nieuweLeverancier: leverancier.fout } };
  }
  const { error } = await supabase
    .from("contracts")
    .update({
      supplier_id: leverancier.id,
      title: kop.data.titel,
      signed_on: kop.data.getekendOp || null,
      notes: kop.data.notities || null,
    })
    .eq("project_id", project.id)
    .eq("id", id);
  if (error) return { fout: dbFout(error) };
  vernieuw(id);
  return { succes: "Opgeslagen." };
}

export async function contractStatusWijzigen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const id = tekst(formData, "id");
  const status = z
    .enum(["actief", "afgerond", "geannuleerd"])
    .safeParse(tekst(formData, "status"));
  if (!status.success) return { fout: "Kies een status." };
  if (status.data === "geannuleerd" && tekst(formData, "bevestig") !== "ja") {
    return {
      fout: "Vink aan dat je het contract wilt annuleren. Alleen wat al gefactureerd is, blijft dan meetellen.",
    };
  }
  const supabase = await createClient();
  const { data: oud } = await supabase
    .from("contracts")
    .select("status")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!oud) return { fout: "Contract niet gevonden." };
  if (oud.status === status.data) return { succes: "Status ongewijzigd." };
  const { error } = await supabase
    .from("contracts")
    .update({ status: status.data })
    .eq("project_id", project.id)
    .eq("id", id);
  if (error) return { fout: dbFout(error) };
  await logActie(project.id, "contract_status", "contracts", id, {
    van: oud.status,
    naar: status.data,
  });
  vernieuw(id);
  return { succes: "Status bijgewerkt." };
}

/**
 * Contract verwijderen, bijvoorbeeld na per ongeluk accepteren. Kan alleen
 * zolang er geen facturen aan hangen. Een gekoppelde offerte gaat terug naar
 * "ontvangen".
 */
export async function contractVerwijderen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  if (tekst(formData, "bevestig") !== "ja") {
    return { fout: "Vink aan dat je het contract wilt verwijderen." };
  }
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, title, quote_id")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!contract) return { fout: "Contract niet gevonden." };
  const [documenten, kosten] = await Promise.all([
    supabase
      .from("cost_documents")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", id),
    supabase
      .from("cost_lines")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", id),
  ]);
  if ((documenten.count ?? 0) + (kosten.count ?? 0) > 0) {
    return {
      fout: "Aan dit contract hangen facturen of bonnen. Annuleer het contract in plaats van het te verwijderen.",
    };
  }
  const { error } = await supabase
    .from("contracts")
    .delete()
    .eq("project_id", project.id)
    .eq("id", id);
  if (error) return { fout: dbFout(error) };
  if (contract.quote_id) {
    await supabase
      .from("quotes")
      .update({ status: "ontvangen" })
      .eq("project_id", project.id)
      .eq("id", contract.quote_id);
  }
  await logActie(project.id, "contract_verwijderd", "contracts", id, {
    titel: contract.title,
  });
  vernieuw();
  redirect(
    contract.quote_id ? `/offertes/${contract.quote_id}` : "/contracten",
  );
}

// -----------------------------------------------------------------------------
// Contractregels
// -----------------------------------------------------------------------------

const regelSchema = z.object({
  omschrijving: z.string().max(300, { error: "Maximaal 300 tekens." }),
  categorieId: z.uuid({ error: "Kies een categorie." }),
  bedrag: z
    .string()
    .regex(/^-?\d+$/, { error: "Vul een bedrag in, bijvoorbeeld 1.250,00." }),
  btw: z.coerce.number().refine(isBtwTarief, { error: "Kies een BTW-tarief." }),
});

export async function contractRegelOpslaan(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const contractId = tekst(formData, "contractId");
  const id = tekst(formData, "id");
  const invoer = regelSchema.safeParse({
    omschrijving: tekst(formData, "omschrijving"),
    categorieId: tekst(formData, "categorieId"),
    bedrag: tekst(formData, "bedrag"),
    btw: tekst(formData, "btw"),
  });
  if (!invoer.success) return { veldfouten: eersteFouten(invoer.error) };
  const bedrag = Number(invoer.data.bedrag);
  if (bedrag < 0)
    return { veldfouten: { bedrag: "Vul een positief bedrag in." } };
  const btw = invoer.data.btw;
  if (!isBtwTarief(btw)) return { veldfouten: { btw: "Kies een BTW-tarief." } };

  const supabase = await createClient();
  const rij = {
    category_id: invoer.data.categorieId,
    description: invoer.data.omschrijving,
    ...bedragKolommen(bedrag, btw),
  };
  if (id) {
    const { error } = await supabase
      .from("contract_lines")
      .update(rij)
      .eq("project_id", project.id)
      .eq("id", id)
      .eq("contract_id", contractId);
    if (error) return { fout: dbFout(error) };
  } else {
    const { data: laatste } = await supabase
      .from("contract_lines")
      .select("sort_order")
      .eq("contract_id", contractId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("contract_lines").insert({
      ...rij,
      project_id: project.id,
      contract_id: contractId,
      sort_order: (laatste?.sort_order ?? 0) + 1,
    });
    if (error) return { fout: dbFout(error) };
  }
  vernieuw(contractId);
  return { succes: id ? "Regel opgeslagen." : "Regel toegevoegd." };
}

export async function contractRegelVerwijderen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { data: regel } = await supabase
    .from("contract_lines")
    .select("contract_id")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!regel) return { fout: "Regel niet gevonden." };
  const [{ count: kosten }, { count: regels }] = await Promise.all([
    supabase
      .from("cost_lines")
      .select("id", { count: "exact", head: true })
      .eq("contract_line_id", id),
    supabase
      .from("contract_lines")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", regel.contract_id),
  ]);
  if ((kosten ?? 0) > 0) {
    return {
      fout: "Aan deze regel hangen facturen of bonnen; verwijderen kan niet.",
    };
  }
  if ((regels ?? 0) <= 1) {
    return { fout: "Een contract heeft minstens één regel." };
  }
  const { error } = await supabase
    .from("contract_lines")
    .delete()
    .eq("project_id", project.id)
    .eq("id", id);
  if (error) return { fout: dbFout(error) };
  vernieuw(regel.contract_id);
  return { succes: "Regel verwijderd." };
}

/** Ruimtes van een contractregel; het bedrag wordt gelijk verdeeld. */
export async function contractRegelRuimtes(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const id = tekst(formData, "id");
  const ruimteIds = z
    .array(z.uuid())
    .max(50)
    .safeParse([...new Set(formData.getAll("ruimteId").map(String))]);
  if (!ruimteIds.success) return { fout: "Kies geldige ruimtes." };
  const supabase = await createClient();
  const { data: regel } = await supabase
    .from("contract_lines")
    .select("contract_id")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!regel) return { fout: "Regel niet gevonden." };

  // Eerst alles weg (som 0 is geldig), daarna in één keer de nieuwe
  // verdeling (som precies 100%): de database controleert dat per opdracht.
  const { error: wisFout } = await supabase
    .from("room_allocations")
    .delete()
    .eq("contract_line_id", id);
  if (wisFout) return { fout: dbFout(wisFout) };
  if (ruimteIds.data.length) {
    const delen = verdeel(
      10_000,
      ruimteIds.data.map(() => 1),
    );
    const { error } = await supabase.from("room_allocations").insert(
      ruimteIds.data.map((ruimteId, i) => ({
        project_id: project.id,
        room_id: ruimteId,
        contract_line_id: id,
        share_bp: delen[i],
      })),
    );
    if (error) return { fout: dbFout(error) };
  }
  vernieuw(regel.contract_id);
  return { succes: "Ruimtes opgeslagen." };
}

// -----------------------------------------------------------------------------
// Meer- en minderwerk
// -----------------------------------------------------------------------------

export async function wijzigingToevoegen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const contractId = tekst(formData, "contractId");
  const invoer = z
    .object({
      regelId: z.uuid({ error: "Kies de contractregel." }),
      omschrijving: z
        .string()
        .min(1, { error: "Omschrijf het meer- of minderwerk." })
        .max(300, { error: "Maximaal 300 tekens." }),
      bedrag: z.string().regex(/^-?\d+$/, {
        error: "Vul een bedrag in; minderwerk met een minteken (-250,00).",
      }),
      btw: z.coerce.number(),
    })
    .safeParse({
      regelId: tekst(formData, "regelId"),
      omschrijving: tekst(formData, "omschrijving"),
      bedrag: tekst(formData, "bedrag"),
      btw: tekst(formData, "btw"),
    });
  if (!invoer.success) return { veldfouten: eersteFouten(invoer.error) };
  const bedrag = Number(invoer.data.bedrag);
  if (bedrag === 0)
    return { veldfouten: { bedrag: "Het bedrag mag niet 0 zijn." } };
  const btw = invoer.data.btw;
  if (!isBtwTarief(btw)) return { veldfouten: { btw: "Kies een BTW-tarief." } };

  const supabase = await createClient();
  const { data: regel } = await supabase
    .from("contract_lines")
    .select("id")
    .eq("project_id", project.id)
    .eq("id", invoer.data.regelId)
    .eq("contract_id", contractId)
    .maybeSingle();
  if (!regel) return { veldfouten: { regelId: "Kies de contractregel." } };

  const { error } = await supabase.from("contract_changes").insert({
    project_id: project.id,
    contract_line_id: regel.id,
    description: invoer.data.omschrijving,
    status: "voorgesteld",
    ...bedragKolommen(bedrag, btw),
  });
  if (error) return { fout: dbFout(error) };
  vernieuw(contractId);
  return {
    succes: "Toegevoegd als voorstel. Het telt mee zodra je akkoord geeft.",
  };
}

export async function wijzigingBesluiten(formData: FormData): Promise<void> {
  const { gebruiker, project, fout } = await bewerkbaarProject();
  if (fout) return;
  const id = tekst(formData, "id");
  const besluit = z
    .enum(["akkoord", "afgewezen", "voorgesteld"])
    .safeParse(tekst(formData, "besluit"));
  if (!besluit.success) return;
  const supabase = await createClient();
  const { data: wijziging } = await supabase
    .from("contract_changes")
    .select("status, contract_lines (contract_id)")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!wijziging || wijziging.status === besluit.data) return;
  const besloten = besluit.data !== "voorgesteld";
  const { error } = await supabase
    .from("contract_changes")
    .update({
      status: besluit.data,
      decided_at: besloten ? new Date().toISOString() : null,
      decided_by: besloten ? gebruiker.id : null,
    })
    .eq("project_id", project.id)
    .eq("id", id);
  if (error) return;
  await logActie(project.id, "wijziging_besluit", "contract_changes", id, {
    van: wijziging.status,
    naar: besluit.data,
  });
  vernieuw(wijziging.contract_lines?.contract_id);
}

export async function wijzigingVerwijderen(formData: FormData): Promise<void> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return;
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { data: wijziging } = await supabase
    .from("contract_changes")
    .select("status, contract_lines (contract_id)")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  // Goedgekeurd werk eerst terugzetten naar voorstel: zo verdwijnt een
  // toezegging nooit ongemerkt uit de prognose.
  if (!wijziging || wijziging.status === "akkoord") return;
  await supabase
    .from("contract_changes")
    .delete()
    .eq("project_id", project.id)
    .eq("id", id);
  vernieuw(wijziging.contract_lines?.contract_id);
}

// -----------------------------------------------------------------------------
// Termijnschema
// -----------------------------------------------------------------------------

/** "30", "12,5" of "12.5" → basispunten (3000, 1250); anders null. */
function percentageNaarBp(waarde: string): number | null {
  const schoon = waarde.replace("%", "").trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(schoon)) return null;
  const bp = Math.round(Number(schoon) * 100);
  return bp >= 1 && bp <= 10_000 ? bp : null;
}

export async function termijnToevoegen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const contractId = tekst(formData, "contractId");
  const soort = tekst(formData, "soort") === "bedrag" ? "bedrag" : "percentage";
  const invoer = z
    .object({
      omschrijving: z
        .string()
        .min(1, { error: "Omschrijf de termijn, bijv. 'Bij oplevering'." })
        .max(200, { error: "Maximaal 200 tekens." }),
      verwachteDatum: datumOfLeeg,
    })
    .safeParse({
      omschrijving: tekst(formData, "omschrijving"),
      verwachteDatum: tekst(formData, "verwachteDatum"),
    });
  if (!invoer.success) return { veldfouten: eersteFouten(invoer.error) };

  let percentageBp: number | null = null;
  let bedrag: number | null = null;
  if (soort === "percentage") {
    percentageBp = percentageNaarBp(tekst(formData, "percentage"));
    if (percentageBp === null) {
      return {
        veldfouten: {
          percentage:
            "Vul een percentage in tussen 0 en 100, bijv. 30 of 12,5.",
        },
      };
    }
  } else {
    const ruw = tekst(formData, "bedrag");
    if (!/^\d+$/.test(ruw) || Number(ruw) <= 0) {
      return { veldfouten: { bedrag: "Vul een positief bedrag in." } };
    }
    bedrag = Number(ruw);
  }

  const supabase = await createClient();
  const { data: bestaand } = await supabase
    .from("contract_installments")
    .select("sequence, percentage_bp")
    .eq("contract_id", contractId);
  const somPercentage = (bestaand ?? []).reduce(
    (a, t) => a + (t.percentage_bp ?? 0),
    0,
  );
  if (percentageBp !== null && somPercentage + percentageBp > 10_000) {
    const rest = (10_000 - somPercentage) / 100;
    return {
      veldfouten: {
        percentage:
          rest > 0
            ? `Samen meer dan 100%. Er is nog ${String(rest).replace(".", ",")}% over.`
            : "Het termijnschema is al 100%.",
      },
    };
  }
  const volgende = Math.max(0, ...(bestaand ?? []).map((t) => t.sequence)) + 1;
  const { error } = await supabase.from("contract_installments").insert({
    project_id: project.id,
    contract_id: contractId,
    sequence: volgende,
    description: invoer.data.omschrijving,
    percentage_bp: percentageBp,
    amount_incl_cents: bedrag,
    expected_date: invoer.data.verwachteDatum || null,
  });
  if (error) return { fout: dbFout(error) };
  vernieuw(contractId);
  return { succes: "Termijn toegevoegd." };
}

export async function termijnVerwijderen(formData: FormData): Promise<void> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return;
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { data: termijn } = await supabase
    .from("contract_installments")
    .select("contract_id")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!termijn) return;
  // Gekoppelde termijnfacturen blijven bestaan (koppeling vervalt).
  await supabase
    .from("contract_installments")
    .delete()
    .eq("project_id", project.id)
    .eq("id", id);
  vernieuw(termijn.contract_id);
}
