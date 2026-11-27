import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ContractDetails = {
  id: string;
  titel: string;
  status: "actief" | "afgerond" | "geannuleerd";
  getekendOp: string | null;
  notities: string | null;
  leverancierId: string | null;
  offerteId: string | null;
  regels: {
    id: string;
    omschrijving: string;
    categorieId: string;
    bedrag: number;
    btw: number;
    gekoppeldeKosten: number;
  }[];
  wijzigingen: {
    id: string;
    contractRegelId: string;
    omschrijving: string;
    status: "voorgesteld" | "akkoord" | "afgewezen";
    bedrag: number;
    btw: number;
    besloten: string | null;
  }[];
  termijnen: {
    id: string;
    volgorde: number;
    omschrijving: string;
    percentageBp: number | null;
    bedrag: number | null;
    verwachteDatum: string | null;
  }[];
};

/** Alles van één contract, voor de detailpagina (via RLS: alleen leden). */
export const laadContract = cache(async function laadContract(
  id: string,
): Promise<ContractDetails | null> {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("contracts")
    .select("id, title, status, signed_on, notes, supplier_id, quote_id")
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;

  const [regels, wijzigingen, termijnen] = await Promise.all([
    supabase
      .from("contract_lines")
      .select(
        "id, description, category_id, amount_incl_cents, vat_rate_bp, sort_order, cost_lines (id)",
      )
      .eq("contract_id", id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("contract_changes")
      .select(
        "id, contract_line_id, description, status, amount_incl_cents, vat_rate_bp, decided_at, created_at, contract_lines!inner (contract_id)",
      )
      .eq("contract_lines.contract_id", id)
      .order("created_at"),
    supabase
      .from("contract_installments")
      .select(
        "id, sequence, description, percentage_bp, amount_incl_cents, expected_date",
      )
      .eq("contract_id", id)
      .order("sequence"),
  ]);

  return {
    id: c.id,
    titel: c.title,
    status: c.status,
    getekendOp: c.signed_on,
    notities: c.notes,
    leverancierId: c.supplier_id,
    offerteId: c.quote_id,
    regels: (regels.data ?? []).map((r) => ({
      id: r.id,
      omschrijving: r.description,
      categorieId: r.category_id,
      bedrag: r.amount_incl_cents,
      btw: r.vat_rate_bp,
      gekoppeldeKosten: r.cost_lines?.length ?? 0,
    })),
    wijzigingen: (wijzigingen.data ?? []).map((w) => ({
      id: w.id,
      contractRegelId: w.contract_line_id,
      omschrijving: w.description,
      status: w.status,
      bedrag: w.amount_incl_cents,
      btw: w.vat_rate_bp,
      besloten: w.decided_at,
    })),
    termijnen: (termijnen.data ?? []).map((t) => ({
      id: t.id,
      volgorde: t.sequence,
      omschrijving: t.description,
      percentageBp: t.percentage_bp,
      bedrag: t.amount_incl_cents,
      verwachteDatum: t.expected_date,
    })),
  };
});
