import "server-only";
import { cache } from "react";
import type { DocumentStatus, DocumentType } from "@/lib/finance";
import { formatEuro } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { categorieLabels, categorieOpties, laadLeveranciers } from "./offertes";
import { laadProjectResultaat } from "./project";

export type DocumentRij = {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  leverancierId: string | null;
  contractId: string | null;
  termijnId: string | null;
  bestandId: string | null;
  nummer: string | null;
  datum: string;
  vervalDatum: string | null;
  /** Omschrijving van de eerste regel (voor bonnen zonder leverancier). */
  eersteRegel: string | null;
};

export type DocumentRegel = {
  id: string;
  omschrijving: string;
  categorieId: string | null;
  contractId: string | null;
  contractRegelId: string | null;
  /** Centen incl. BTW. */
  bedrag: number;
  btw: number;
  ruimteIds: string[];
};

export type Betaling = {
  id: string;
  bedrag: number;
  datum: string;
  omschrijving: string | null;
  bronId: string | null;
};

export type DocumentDetails = DocumentRij & {
  bron: "handmatig" | "ai";
  totaalOpDocument: number | null;
  notities: string | null;
  geboektOp: string | null;
  geboektDoor: string | null;
  regels: DocumentRegel[];
  betalingen: Betaling[];
};

/** Alle documenten van het project (via RLS: alleen leden), nieuwste eerst. */
export const laadDocumenten = cache(
  async (projectId: string): Promise<DocumentRij[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cost_documents")
      .select(
        "id, type, status, supplier_id, contract_id, installment_id, file_id, document_number, document_date, due_date, created_at, cost_lines (description, sort_order)",
      )
      .eq("project_id", projectId)
      .order("document_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Documenten ophalen mislukt: ${error.message}`);
    return (data ?? []).map((d) => ({
      id: d.id,
      type: d.type,
      status: d.status,
      leverancierId: d.supplier_id,
      contractId: d.contract_id,
      termijnId: d.installment_id,
      bestandId: d.file_id,
      nummer: d.document_number,
      datum: d.document_date,
      vervalDatum: d.due_date,
      eersteRegel:
        [...(d.cost_lines ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .find((l) => l.description)?.description ?? null,
    }));
  },
);

/** Eén document met regels, ruimtes en betalingen. */
export const laadDocument = cache(
  async (id: string): Promise<DocumentDetails | null> => {
    const supabase = await createClient();
    const { data: d } = await supabase
      .from("cost_documents")
      .select(
        "id, type, status, source, supplier_id, contract_id, installment_id, file_id, document_number, document_date, due_date, stated_total_incl_cents, notes, booked_at, reviewed_by",
      )
      .eq("id", id)
      .maybeSingle();
    if (!d) return null;

    const [regels, betalingen, profiel] = await Promise.all([
      supabase
        .from("cost_lines")
        .select(
          "id, description, category_id, contract_id, contract_line_id, amount_incl_cents, vat_rate_bp, sort_order, room_allocations (room_id, share_bp)",
        )
        .eq("cost_document_id", id)
        .order("sort_order"),
      supabase
        .from("payments")
        .select("id, amount_cents, paid_on, description, funding_source_id")
        .eq("cost_document_id", id)
        .order("paid_on")
        .order("created_at"),
      d.status === "geboekt" && d.reviewed_by
        ? supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", d.reviewed_by)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return {
      id: d.id,
      type: d.type,
      status: d.status,
      bron: d.source,
      leverancierId: d.supplier_id,
      contractId: d.contract_id,
      termijnId: d.installment_id,
      bestandId: d.file_id,
      nummer: d.document_number,
      datum: d.document_date,
      vervalDatum: d.due_date,
      totaalOpDocument: d.stated_total_incl_cents,
      notities: d.notes,
      geboektOp: d.booked_at,
      geboektDoor: profiel.data?.full_name || profiel.data?.email || null,
      eersteRegel: null,
      regels: (regels.data ?? []).map((r) => ({
        id: r.id,
        omschrijving: r.description,
        categorieId: r.category_id,
        contractId: r.contract_id,
        contractRegelId: r.contract_line_id,
        bedrag: r.amount_incl_cents,
        btw: r.vat_rate_bp,
        ruimteIds: (r.room_allocations ?? []).map((a) => a.room_id),
      })),
      betalingen: (betalingen.data ?? []).map((b) => ({
        id: b.id,
        bedrag: b.amount_cents,
        datum: b.paid_on,
        omschrijving: b.description,
        bronId: b.funding_source_id,
      })),
    };
  },
);

/** Financieringsbronnen waaruit betaald kan worden (geen hypotheek-met-delen). */
export const laadBetaalbronnen = cache(async (projectId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("funding_sources")
    .select("id, name, parent_source_id")
    .eq("project_id", projectId)
    .order("created_at");
  const rijen = data ?? [];
  const heeftDelen = new Set(rijen.map((r) => r.parent_source_id));
  return rijen
    .filter((r) => !heeftDelen.has(r.id))
    .map((r) => ({ id: r.id, naam: r.name }));
});

/**
 * Keuzelijsten voor het documentformulier: leveranciers, contracten (met
 * regels en termijnen), eindcategorieën en ruimtes.
 */
export const documentKeuzes = cache(async (projectId: string) => {
  const [leveranciers, { invoer, resultaat }] = await Promise.all([
    laadLeveranciers(projectId),
    laadProjectResultaat(projectId),
  ]);
  const labels = categorieLabels(invoer.categorieen);
  const leverancierNaam = new Map(leveranciers.map((l) => [l.id, l.naam]));
  const contracten = invoer.contracten
    .map((c) => {
      const cijfers = resultaat.contracten.find((x) => x.id === c.id);
      const regels = invoer.contractRegels.filter((r) => r.contractId === c.id);
      return {
        id: c.id,
        titel: c.titel,
        leverancierId: c.leverancierId,
        leverancier: c.leverancierId
          ? (leverancierNaam.get(c.leverancierId) ?? null)
          : null,
        geannuleerd: c.status === "geannuleerd",
        nogTeFactureren: cijfers?.nogTeFactureren ?? 0,
        regels: regels.map((r, i) => ({
          id: r.id,
          label: `${r.omschrijving || `Regel ${i + 1}`} (${labels.get(r.categorieId) ?? "?"})`,
        })),
        termijnen: (cijfers?.termijnen ?? []).map((t) => ({
          id: t.id,
          volgorde: t.volgorde,
          omschrijving: t.omschrijving,
          verwacht: t.verwachtBedrag,
          gefactureerd: t.gefactureerd,
          label: `${t.volgorde}. ${t.omschrijving} · ${formatEuro(t.verwachtBedrag)}${
            t.gefactureerd !== 0
              ? ` (${formatEuro(t.gefactureerd)} gefactureerd)`
              : ""
          }`,
        })),
      };
    })
    .sort((a, b) => a.titel.localeCompare(b.titel, "nl"));
  return {
    leveranciers: leveranciers.map((l) => ({ id: l.id, naam: l.naam })),
    contracten,
    categorieen: categorieOpties(invoer.categorieen),
    labels,
    ruimtes: [...invoer.ruimtes]
      .sort((a, b) => a.volgorde - b.volgorde)
      .map((r) => ({ id: r.id, naam: r.naam })),
  };
});

export type DocumentItem = {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  titel: string;
  nummer: string | null;
  datum: string;
  vervalDatum: string | null;
  leverancierId: string | null;
  contractId: string | null;
  contractTitel: string | null;
  totaal: number;
  betaald: number;
  openstaand: number;
  betaalStatus: "open" | "deels" | "betaald" | "te_laat" | null;
  dagenTotVervallen: number | null;
};

/** Documenten met naam, contract en de cijfers uit de rekenlogica. */
export const documentOverzicht = cache(
  async (projectId: string): Promise<DocumentItem[]> => {
    const [rijen, leveranciers, { invoer, resultaat }] = await Promise.all([
      laadDocumenten(projectId),
      laadLeveranciers(projectId),
      laadProjectResultaat(projectId),
    ]);
    const naam = new Map(leveranciers.map((l) => [l.id, l.naam]));
    const contract = new Map(invoer.contracten.map((c) => [c.id, c.titel]));
    const cijfers = new Map(resultaat.documenten.map((d) => [d.id, d]));
    return rijen.map((d) => {
      const c = cijfers.get(d.id);
      return {
        id: d.id,
        type: d.type,
        status: d.status,
        titel:
          (d.leverancierId && naam.get(d.leverancierId)) ||
          d.eersteRegel ||
          (d.type === "bon" ? "Bon" : "Zonder leverancier"),
        nummer: d.nummer,
        datum: d.datum,
        vervalDatum: d.vervalDatum,
        leverancierId: d.leverancierId,
        contractId: d.contractId,
        contractTitel: d.contractId
          ? (contract.get(d.contractId) ?? null)
          : null,
        totaal: c?.totaal ?? 0,
        betaald: c?.betaald ?? 0,
        openstaand: c?.openstaand ?? 0,
        betaalStatus: c?.betaalStatus ?? null,
        dagenTotVervallen: c?.dagenTotVervallen ?? null,
      };
    });
  },
);
