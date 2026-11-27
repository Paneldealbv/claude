import "server-only";
import { cache } from "react";
import { z } from "zod";
import { vandaagIso } from "@/lib/datum";
import {
  dagenTot,
  declarabel,
  depotStand,
  type DepotStand,
} from "@/lib/financiering";
import { formatDatum } from "@/lib/format";
import {
  DOCUMENT_TYPE,
  type BronSoort,
  type DeclaratieStatus,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { documentOverzicht, type DocumentItem } from "./documenten";
import { laadProjectResultaat } from "./project";

/*
 * Financiering (fase 9): bronnen met hun saldo (uit de rekenlogica), de
 * declaraties bij het bouwdepot en betalingen zonder bron.
 */

export type DeelWeergave = {
  id: string;
  type: BronSoort;
  naam: string;
  bedrag: number;
  betaald: number;
  saldo: number;
  start: string | null;
  eind: string | null;
};

export type BronWeergave = DeelWeergave & {
  verstrekker: string | null;
  renteBp: number | null;
  notities: string | null;
  delen: DeelWeergave[];
};

export type DeclaratieRegel = {
  id: string;
  documentId: string;
  titel: string;
  bedrag: number;
};

export type DeclaratieWeergave = {
  id: string;
  depotId: string;
  nummer: string | null;
  bedrag: number;
  status: DeclaratieStatus;
  ingediendOp: string | null;
  uitbetaaldOp: string | null;
  notities: string | null;
  regels: DeclaratieRegel[];
};

export type DepotWeergave = DeelWeergave & {
  hypotheek: string;
  stand: DepotStand;
  /** Dagen tot de einddatum van het bouwdepot (negatief = verlopen). */
  dagenTotEinde: number | null;
  declaraties: DeclaratieWeergave[];
};

export type BetalingZonderBron = {
  id: string;
  documentId: string;
  titel: string;
  bedrag: number;
  datum: string;
};

/** "Factuur F-001 · Bouwbedrijf" (zonder nummer: de datum). */
export function documentTitel(d: DocumentItem) {
  return `${DOCUMENT_TYPE[d.type].tekst} ${d.nummer ?? formatDatum(d.datum)} · ${d.titel}`;
}

export const laadFinanciering = cache(async (projectId: string) => {
  const supabase = await createClient();
  const [{ resultaat }, bronnen, declaraties, zonderBron, documenten] =
    await Promise.all([
      laadProjectResultaat(projectId),
      supabase
        .from("funding_sources")
        .select(
          "id, parent_source_id, type, name, lender, amount_cents, interest_rate_bp, start_date, end_date, notes",
        )
        .eq("project_id", projectId)
        .order("created_at"),
      supabase
        .from("depot_claims")
        .select(
          "id, funding_source_id, claim_number, amount_cents, status, submitted_on, paid_out_on, notes, created_at, depot_claim_lines (id, cost_document_id, amount_cents)",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("id, cost_document_id, amount_cents, paid_on")
        .eq("project_id", projectId)
        .is("funding_source_id", null)
        .order("paid_on", { ascending: false }),
      documentOverzicht(projectId),
    ]);

  const doc = new Map(documenten.map((d) => [d.id, d]));
  const titel = (id: string) => {
    const d = doc.get(id);
    return d ? documentTitel(d) : "Document";
  };
  const rij = new Map((bronnen.data ?? []).map((b) => [b.id, b]));
  const f = resultaat.financiering;
  const vandaag = vandaagIso();

  const deel = (id: string, betaald: number, saldo: number): DeelWeergave => {
    const r = rij.get(id)!;
    return {
      id,
      type: r.type,
      naam: r.name,
      bedrag: r.amount_cents,
      betaald,
      saldo,
      start: r.start_date,
      eind: r.end_date,
    };
  };

  const lijst: BronWeergave[] = f.bronnen
    .filter((b) => rij.has(b.id))
    .map((b) => {
      const r = rij.get(b.id)!;
      return {
        ...deel(b.id, b.betaald, b.saldo),
        verstrekker: r.lender,
        renteBp: r.interest_rate_bp,
        notities: r.notes,
        delen: b.delen
          .filter((d) => rij.has(d.id))
          .map((d) => deel(d.id, d.betaald, d.saldo)),
      };
    });

  const alleDeclaraties: DeclaratieWeergave[] = (declaraties.data ?? []).map(
    (c) => ({
      id: c.id,
      depotId: c.funding_source_id,
      nummer: c.claim_number,
      bedrag: c.depot_claim_lines.reduce((a, l) => a + l.amount_cents, 0),
      status: c.status,
      ingediendOp: c.submitted_on,
      uitbetaaldOp: c.paid_out_on,
      notities: c.notes,
      regels: c.depot_claim_lines.map((l) => ({
        id: l.id,
        documentId: l.cost_document_id,
        titel: titel(l.cost_document_id),
        bedrag: l.amount_cents,
      })),
    }),
  );

  const depots: DepotWeergave[] = lijst.flatMap((b) =>
    b.delen
      .filter((d) => d.type === "bouwdepot")
      .map((d) => {
        const eigen = alleDeclaraties.filter((c) => c.depotId === d.id);
        return {
          ...d,
          hypotheek: b.naam,
          stand: depotStand(d, eigen),
          dagenTotEinde: dagenTot(d.eind, vandaag),
          declaraties: eigen,
        };
      }),
  );

  return {
    cijfers: {
      totaal: f.totaalBeschikbaar,
      prognose: resultaat.cijfers.prognose,
      ruimte: f.ruimte,
      betaald: resultaat.cijfers.betaald,
      nogTeBetalen: f.nogTeBetalen,
      beschikbaarNaBetalingen: f.beschikbaarNaBetalingen,
      betaaldZonderBron: f.betaaldZonderBron,
    },
    bronnen: lijst,
    depots,
    declaraties: alleDeclaraties,
    zonderBron: (zonderBron.data ?? []).map((p): BetalingZonderBron => ({
      id: p.id,
      documentId: p.cost_document_id,
      titel: titel(p.cost_document_id),
      bedrag: p.amount_cents,
      datum: p.paid_on,
    })),
  };
});

export type Financiering = Awaited<ReturnType<typeof laadFinanciering>>;

/** Bronnen waaruit je kunt betalen: hoofdbronnen zonder delen, en de delen. */
export function betaalbronnen(bronnen: BronWeergave[]) {
  return bronnen.flatMap((b) =>
    b.delen.length
      ? b.delen.map((d) => ({ id: d.id, naam: `${d.naam} (${b.naam})` }))
      : [{ id: b.id, naam: b.naam }],
  );
}

/** Eén hoofdbron (met delen) om te bewerken. */
export async function laadBron(projectId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { bronnen } = await laadFinanciering(projectId);
  return bronnen.find((b) => b.id === id) ?? null;
}

/** Eén declaratie met het bouwdepot waar hij bij hoort. */
export async function laadDeclaratie(projectId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { declaraties, depots } = await laadFinanciering(projectId);
  const declaratie = declaraties.find((c) => c.id === id);
  if (!declaratie) return null;
  const depot = depots.find((d) => d.id === declaratie.depotId) ?? null;
  return { declaratie, depot };
}

export type DeclarabelDocument = {
  id: string;
  titel: string;
  datum: string;
  totaal: number;
  betaald: number;
  /** Wat er nog in een declaratie kan (totaal − al gedeclareerd elders). */
  max: number;
};

/**
 * Geboekte facturen en bonnen die (nog) in een declaratie kunnen. Bij het
 * bewerken telt de declaratie zelf niet mee als "al gedeclareerd".
 */
export async function declarabeleDocumenten(
  projectId: string,
  behalveDeclaratie?: string,
): Promise<DeclarabelDocument[]> {
  const [documenten, { declaraties }] = await Promise.all([
    documentOverzicht(projectId),
    laadFinanciering(projectId),
  ]);
  const geclaimd = new Map<string, number>();
  for (const c of declaraties) {
    if (c.status === "afgewezen" || c.id === behalveDeclaratie) continue;
    for (const r of c.regels) {
      geclaimd.set(r.documentId, (geclaimd.get(r.documentId) ?? 0) + r.bedrag);
    }
  }
  return documenten
    .filter((d) => d.status === "geboekt" && d.totaal > 0)
    .map((d) => ({
      id: d.id,
      titel: documentTitel(d),
      datum: d.datum,
      totaal: d.totaal,
      betaald: d.betaald,
      max: declarabel(d.totaal, geclaimd.get(d.id) ?? 0),
    }))
    .sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
}
