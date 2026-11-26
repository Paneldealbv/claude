"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isBtwTarief, type BtwTarief } from "@/lib/btw";
import { isGeldigeIsoDatum } from "@/lib/datum";
import { formatDatum, formatEuro } from "@/lib/format";
import { DOCUMENT_TYPE } from "@/lib/labels";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { dbFout } from "./fouten";
import {
  bedragKolommen,
  bewerkbaarProject,
  datumOfLeeg,
  eersteFouten,
  leverancierBepalen,
  logActie,
  ruimBestandOp,
  tekst,
} from "./hulp";
import type { ActieStatus } from "./project";

/*
 * Facturen, termijnfacturen, eindfacturen, creditnota's en bonnen.
 * Opslaan gaat in één keer via de databasefunctie save_cost_document: het
 * document, alle regels en de ruimteverdeling, of niets. Alleen geboekte
 * documenten tellen mee in de cijfers.
 */

const TYPES = [
  "factuur",
  "termijnfactuur",
  "eindfactuur",
  "creditnota",
  "bon",
] as const;

function vernieuw() {
  for (const pad of [
    "/documenten",
    "/te-controleren",
    "/contracten",
    "/leveranciers",
    "/budget",
  ]) {
    revalidatePath(pad, "layout");
  }
  revalidatePath("/ruimtes");
  revalidatePath("/dashboard");
}

function documentFout(error: PostgrestError | null): string {
  if (
    error?.code === "23505" &&
    error.message.includes("cost_documents_number_unique")
  ) {
    return "Er staat al een document met dit nummer van deze leverancier. Controleer of je het niet dubbel invoert.";
  }
  return dbFout(error);
}

// -----------------------------------------------------------------------------
// Regels
// -----------------------------------------------------------------------------

type Regel = {
  omschrijving: string;
  doel: { soort: "k" | "c" | "r"; id: string };
  bedrag: number;
  btw: BtwTarief;
  ruimtes: string[];
};

const DOEL = /^([kcr]):([0-9a-f-]{36})$/;

/** Regels uit de KostenRegelsEditor (JSON in één formulierveld). */
function leesKostenRegels(
  waarde: string,
): { regels: Regel[] } | { fout: string } {
  let ruw: unknown;
  try {
    ruw = JSON.parse(waarde || "[]");
  } catch {
    return { fout: "De regels konden niet worden gelezen." };
  }
  const invoer = z
    .array(
      z.object({
        omschrijving: z.string().max(300),
        doel: z.string().max(40),
        bedrag: z.number().int().nullable(),
        btw: z.number(),
        ruimtes: z.array(z.uuid()).max(50),
      }),
    )
    .max(200)
    .safeParse(ruw);
  if (!invoer.success) return { fout: "De regels konden niet worden gelezen." };

  const regels: Regel[] = [];
  const gevuld = invoer.data.filter(
    (r) =>
      r.omschrijving !== "" ||
      r.doel !== "" ||
      r.bedrag !== null ||
      r.ruimtes.length > 0,
  );
  for (const [i, r] of gevuld.entries()) {
    const doel = DOEL.exec(r.doel);
    if (!doel) {
      return {
        fout: `Kies bij regel ${i + 1} waar de kosten bij horen (een contract of een categorie).`,
      };
    }
    if (r.bedrag === null) {
      return { fout: `Vul bij regel ${i + 1} een geldig bedrag in.` };
    }
    if (!isBtwTarief(r.btw)) {
      return { fout: `Kies bij regel ${i + 1} een BTW-tarief.` };
    }
    regels.push({
      omschrijving: r.omschrijving,
      doel: { soort: doel[1] as "k" | "c" | "r", id: doel[2] },
      bedrag: r.bedrag,
      btw: r.btw,
      ruimtes: [...new Set(r.ruimtes)],
    });
  }
  return { regels };
}

// -----------------------------------------------------------------------------
// Opslaan (nieuw of bewerken)
// -----------------------------------------------------------------------------

const kopSchema = z.object({
  type: z.enum(TYPES, { error: "Kies het soort document." }),
  nummer: z.string().max(60, { error: "Maximaal 60 tekens." }),
  datum: z.string().refine(isGeldigeIsoDatum, {
    error: "Vul de datum van het document in (DD-MM-JJJJ).",
  }),
  vervalDatum: datumOfLeeg,
  totaal: z.string().regex(/^(-?\d+)?$/, {
    error: "Vul een geldig bedrag in, bijvoorbeeld 1.250,00.",
  }),
  contractId: z.uuid().or(z.literal("")),
  termijnId: z.uuid().or(z.literal("")),
  bestandId: z.uuid().or(z.literal("")),
  extractieId: z.uuid().or(z.literal("")),
  notities: z.string().max(2000, { error: "Maximaal 2000 tekens." }),
});

/** AI-voorstellen die nog niet tot een document hebben geleid. */
const OPEN_VOORSTEL = [
  "wachtrij",
  "bezig",
  "te_controleren",
  "mislukt",
] as const;

export async function documentOpslaan(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { gebruiker, project, fout } = await bewerkbaarProject();
  if (fout) return { fout };

  const kop = kopSchema.safeParse({
    type: tekst(formData, "type"),
    nummer: tekst(formData, "nummer"),
    datum: tekst(formData, "datum"),
    vervalDatum: tekst(formData, "vervalDatum"),
    totaal: tekst(formData, "totaal"),
    contractId: tekst(formData, "contractId"),
    termijnId: tekst(formData, "termijnId"),
    bestandId: tekst(formData, "bestandId"),
    extractieId: tekst(formData, "extractieId"),
    notities: tekst(formData, "notities"),
  });
  if (!kop.success) {
    return {
      veldfouten: eersteFouten(kop.error),
      fout: "Controleer de gemarkeerde velden.",
    };
  }
  const k = kop.data;
  const veldfouten: Record<string, string> = {};
  if (
    (k.type === "termijnfactuur" || k.type === "eindfactuur") &&
    !k.contractId
  ) {
    veldfouten.contractId = "Kies het contract waar deze factuur bij hoort.";
  }
  if (k.vervalDatum && k.vervalDatum < k.datum) {
    veldfouten.vervalDatum =
      "De vervaldatum ligt vóór de datum van het document.";
  }
  if (Object.keys(veldfouten).length) {
    return { veldfouten, fout: "Controleer de gemarkeerde velden." };
  }

  const gelezen = leesKostenRegels(tekst(formData, "regels"));
  if ("fout" in gelezen) return { fout: gelezen.fout };
  // Een creditnota vermindert de kosten: bedragen worden negatief opgeslagen.
  const teken = (bedrag: number) =>
    k.type === "creditnota" && bedrag > 0 ? -bedrag : bedrag;
  const regels = gelezen.regels.map((r) => ({ ...r, bedrag: teken(r.bedrag) }));
  const totaal = k.totaal === "" ? null : teken(Number(k.totaal));

  const id = tekst(formData, "id");
  const actie = tekst(formData, "actie");
  const supabase = await createClient();

  let huidig: { status: string; file_id: string | null } | null = null;
  if (id) {
    const { data } = await supabase
      .from("cost_documents")
      .select("status, file_id")
      .eq("project_id", project.id)
      .eq("id", id)
      .maybeSingle();
    if (!data) return { fout: "Document niet gevonden." };
    if (data.status === "vervallen") {
      return {
        fout: "Een vervallen document kun je niet wijzigen. Herstel het eerst.",
      };
    }
    huidig = data;
  }
  const status =
    actie === "boeken"
      ? "geboekt"
      : actie === "concept"
        ? "concept"
        : (huidig?.status ?? "concept");

  // Vanuit een AI-voorstel: het voorstel moet nog open staan.
  let extractie: { id: string } | null = null;
  if (k.extractieId) {
    const { data } = await supabase
      .from("document_extractions")
      .select("id, status, cost_document_id")
      .eq("project_id", project.id)
      .eq("id", k.extractieId)
      .maybeSingle();
    if (!data) return { fout: "Het voorstel bestaat niet meer." };
    if (data.status === "verwerkt") {
      return {
        fout: "Dit voorstel is al verwerkt tot een document.",
        link: data.cost_document_id
          ? `/documenten/${data.cost_document_id}`
          : undefined,
      };
    }
    extractie = data;
  }

  if (status === "geboekt" && extractie) {
    // Boeken na controle van een AI-voorstel: de gegevens die nodig zijn om
    // het document te controleren en dubbel invoeren te voorkomen.
    const verplicht: Record<string, string> = {};
    if (k.type !== "bon" && !k.nummer) {
      verplicht.nummer = "Vul het nummer van het document in.";
    }
    if (totaal === null) {
      verplicht.totaal =
        "Vul het totaal van het document in; zo wordt gecontroleerd of de regels kloppen.";
    }
    if (Object.keys(verplicht).length) {
      return {
        veldfouten: verplicht,
        fout: "Vul de gemarkeerde velden in om te boeken, of sla het op als concept.",
      };
    }
  }

  if (status === "geboekt") {
    if (!regels.length) {
      return { fout: "Voeg minstens één regel toe om het document te boeken." };
    }
    const som = regels.reduce((a, r) => a + r.bedrag, 0);
    if (totaal !== null && som !== totaal) {
      return {
        fout: `De regels tellen op tot ${formatEuro(som)}, maar op het document staat ${formatEuro(totaal)}. Pas de regels of het totaal aan, of sla het op als concept.`,
      };
    }
  }

  // Hetzelfde bestand mag maar bij één document horen.
  if (k.bestandId) {
    const { data: ander } = await supabase
      .from("cost_documents")
      .select("id, type, document_number, document_date")
      .eq("project_id", project.id)
      .eq("file_id", k.bestandId)
      .neq("status", "vervallen")
      .neq("id", id || "00000000-0000-0000-0000-000000000000")
      .limit(1)
      .maybeSingle();
    if (ander) {
      return {
        fout: `Dit bestand is al ingevoerd: ${DOCUMENT_TYPE[ander.type].tekst.toLowerCase()} ${ander.document_number ?? ""} van ${formatDatum(ander.document_date)}.`.replace(
          /\s+/g,
          " ",
        ),
        link: `/documenten/${ander.id}`,
      };
    }
  }

  const leverancier = await leverancierBepalen(supabase, project.id, formData);
  if ("fout" in leverancier) {
    return {
      fout: "Controleer de gemarkeerde velden.",
      veldfouten: { nieuweLeverancier: leverancier.fout },
    };
  }

  // Geen leverancier gekozen maar wel een contract: die van het contract.
  let leverancierId = leverancier.id;
  if (!leverancierId && k.contractId) {
    const { data: c } = await supabase
      .from("contracts")
      .select("supplier_id")
      .eq("project_id", project.id)
      .eq("id", k.contractId)
      .maybeSingle();
    leverancierId = c?.supplier_id ?? null;
  }
  if (status === "geboekt" && extractie && k.type !== "bon" && !leverancierId) {
    return {
      veldfouten: {
        leverancierId: "Kies de leverancier of maak een nieuwe aan.",
      },
      fout: "Vul de gemarkeerde velden in om te boeken, of sla het op als concept.",
    };
  }

  const document = {
    id: id || null,
    project_id: project.id,
    type: k.type,
    status,
    supplier_id: leverancierId,
    file_id: k.bestandId || null,
    contract_id: k.contractId || null,
    installment_id:
      k.type === "termijnfactuur" && k.contractId ? k.termijnId || null : null,
    document_number: k.nummer || null,
    document_date: k.datum,
    due_date: k.type === "bon" ? null : k.vervalDatum || null,
    stated_total_incl_cents: totaal,
    notes: k.notities || null,
    // Alleen bij een nieuw document; de bron verandert daarna niet meer.
    source: extractie ? "ai" : "handmatig",
  };
  const lines = regels.map((r) => ({
    description: r.omschrijving,
    category_id: r.doel.soort === "k" ? r.doel.id : null,
    contract_id: r.doel.soort === "c" ? r.doel.id : null,
    contract_line_id: r.doel.soort === "r" ? r.doel.id : null,
    ...bedragKolommen(r.bedrag, r.btw),
    rooms: r.ruimtes,
  }));

  const { data: opgeslagen, error } = await supabase.rpc("save_cost_document", {
    p_document: document as Json,
    p_lines: lines as Json,
  });
  if (error || !opgeslagen) return { fout: documentFout(error) };

  if (status === "geboekt" && huidig?.status !== "geboekt") {
    await logActie(
      project.id,
      "document_geboekt",
      "cost_documents",
      opgeslagen,
      {
        type: k.type,
        totaal: regels.reduce((a, r) => a + r.bedrag, 0),
        ...(extractie ? { bron: "ai" } : {}),
      },
    );
  }
  // Het voorstel (en elk ander open voorstel voor dit bestand) is verwerkt.
  const verwerkt = {
    status: "verwerkt" as const,
    cost_document_id: opgeslagen,
    reviewed_by: gebruiker.id,
    reviewed_at: new Date().toISOString(),
    error: null,
  };
  if (extractie) {
    await supabase
      .from("document_extractions")
      .update(verwerkt)
      .eq("project_id", project.id)
      .eq("id", extractie.id);
  }
  if (document.file_id) {
    await supabase
      .from("document_extractions")
      .update(verwerkt)
      .eq("project_id", project.id)
      .eq("file_id", document.file_id)
      .in("status", OPEN_VOORSTEL);
  }
  if (huidig?.file_id && huidig.file_id !== document.file_id) {
    await ruimBestandOp(supabase, project.id, huidig.file_id);
  }
  vernieuw();
  redirect(`/documenten/${opgeslagen}`);
}

// -----------------------------------------------------------------------------
// Status: boeken, terug naar concept, vervallen, herstellen
// -----------------------------------------------------------------------------

export async function documentStatusWijzigen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const id = tekst(formData, "id");
  const naar = z
    .enum(["geboekt", "concept", "vervallen"])
    .safeParse(tekst(formData, "naar"));
  if (!naar.success) return { fout: "Kies wat je met het document wilt doen." };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("cost_documents")
    .select("status, cost_lines (id), payments (id)")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { fout: "Document niet gevonden." };
  if (doc.status === naar.data) return { succes: "Status ongewijzigd." };
  if (naar.data === "geboekt" && !(doc.cost_lines ?? []).length) {
    return { fout: "Voeg eerst minstens één regel toe (via Bewerken)." };
  }
  if (naar.data !== "geboekt" && (doc.payments ?? []).length) {
    return {
      fout: "Er zijn al betalingen op dit document. Verwijder eerst de betalingen.",
    };
  }
  if (naar.data === "vervallen" && tekst(formData, "bevestig") !== "ja") {
    return {
      fout: "Vink aan dat het document vervalt. Het telt daarna nergens meer mee.",
    };
  }

  const { error } = await supabase
    .from("cost_documents")
    .update({ status: naar.data })
    .eq("project_id", project.id)
    .eq("id", id);
  if (error) return { fout: documentFout(error) };
  await logActie(project.id, `document_${naar.data}`, "cost_documents", id, {
    van: doc.status,
  });
  vernieuw();
  return {
    succes:
      naar.data === "geboekt"
        ? "Geboekt. Het document telt nu mee."
        : naar.data === "vervallen"
          ? "Het document is vervallen en telt niet meer mee."
          : "Teruggezet naar concept. Het document telt niet meer mee tot je het boekt.",
  };
}

// -----------------------------------------------------------------------------
// Verwijderen
// -----------------------------------------------------------------------------

export async function documentVerwijderen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  if (tekst(formData, "bevestig") !== "ja") {
    return { fout: "Vink aan dat je het document wilt verwijderen." };
  }
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { data: bestand, error } = await supabase.rpc("delete_cost_document", {
    p_document: id,
  });
  if (error) return { fout: documentFout(error) };
  await logActie(project.id, "document_verwijderd", "cost_documents", id);
  if (bestand) await ruimBestandOp(supabase, project.id, bestand);
  vernieuw();
  redirect("/documenten");
}

// -----------------------------------------------------------------------------
// Betalingen
// -----------------------------------------------------------------------------

export async function betalingToevoegen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const documentId = tekst(formData, "documentId");
  const invoer = z
    .object({
      bedrag: z.string().regex(/^-?\d+$/, {
        error: "Vul het betaalde bedrag in, bijvoorbeeld 1.250,00.",
      }),
      datum: z.string().refine(isGeldigeIsoDatum, {
        error: "Vul de betaaldatum in (DD-MM-JJJJ).",
      }),
      bronId: z.uuid().or(z.literal("")),
      omschrijving: z.string().max(200, { error: "Maximaal 200 tekens." }),
    })
    .safeParse({
      bedrag: tekst(formData, "bedrag"),
      datum: tekst(formData, "datum"),
      bronId: tekst(formData, "bronId"),
      omschrijving: tekst(formData, "omschrijving"),
    });
  if (!invoer.success) return { veldfouten: eersteFouten(invoer.error) };
  let bedrag = Number(invoer.data.bedrag);
  if (bedrag === 0)
    return { veldfouten: { bedrag: "Het bedrag mag niet 0 zijn." } };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("cost_documents")
    .select("status, cost_lines (amount_incl_cents)")
    .eq("project_id", project.id)
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { fout: "Document niet gevonden." };
  if (doc.status !== "geboekt") {
    return {
      fout: "Boek het document eerst; pas dan kun je betalingen vastleggen.",
    };
  }
  // Creditnota (negatief totaal): een terugbetaling is ook negatief.
  const totaal = (doc.cost_lines ?? []).reduce(
    (a, r) => a + r.amount_incl_cents,
    0,
  );
  if (totaal < 0 && bedrag > 0) bedrag = -bedrag;

  const { error } = await supabase.from("payments").insert({
    project_id: project.id,
    cost_document_id: documentId,
    amount_cents: bedrag,
    paid_on: invoer.data.datum,
    funding_source_id: invoer.data.bronId || null,
    description: invoer.data.omschrijving || null,
  });
  if (error) return { fout: documentFout(error) };
  vernieuw();
  return {
    succes: totaal < 0 ? "Terugbetaling vastgelegd." : "Betaling vastgelegd.",
  };
}

export async function betalingVerwijderen(formData: FormData): Promise<void> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return;
  const supabase = await createClient();
  await supabase
    .from("payments")
    .delete()
    .eq("project_id", project.id)
    .eq("id", tekst(formData, "id"));
  vernieuw();
}
