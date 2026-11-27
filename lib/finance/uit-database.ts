/**
 * Vertaling van databaserijen (Supabase) naar de invoer van de rekenlogica.
 * Alleen de kolommen die de berekening nodig heeft; bedragen incl. BTW.
 */
import type { Database } from "@/lib/supabase/database.types";
import type { ProjectInvoer } from "./types";

type Rij<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

type Kies<
  T extends keyof Database["public"]["Tables"],
  K extends keyof Rij<T>,
> = Pick<Rij<T>, K>;

/** De kolommen die de loader per tabel moet ophalen. */
export const KOLOMMEN = {
  categories: "id, parent_id, name, sort_order, is_closed",
  budget_lines: "id, category_id, amount_incl_cents",
  contracts: "id, title, supplier_id, status",
  contract_lines:
    "id, contract_id, category_id, description, amount_incl_cents",
  contract_changes: "id, contract_line_id, status, amount_incl_cents",
  contract_installments:
    "id, contract_id, sequence, description, percentage_bp, amount_incl_cents, expected_date",
  cost_documents:
    "id, type, status, supplier_id, contract_id, installment_id, document_date, due_date",
  cost_lines:
    "id, cost_document_id, category_id, contract_id, contract_line_id, amount_incl_cents",
  rooms: "id, name, sort_order",
  room_allocations: "room_id, cost_line_id, contract_line_id, share_bp",
  payments: "id, cost_document_id, funding_source_id, amount_cents, paid_on",
  funding_sources: "id, parent_source_id, type, name, amount_cents",
} as const;

export type DatabaseRijen = {
  categories: Kies<
    "categories",
    "id" | "parent_id" | "name" | "sort_order" | "is_closed"
  >[];
  budget_lines: Kies<
    "budget_lines",
    "id" | "category_id" | "amount_incl_cents"
  >[];
  contracts: Kies<"contracts", "id" | "title" | "supplier_id" | "status">[];
  contract_lines: Kies<
    "contract_lines",
    "id" | "contract_id" | "category_id" | "description" | "amount_incl_cents"
  >[];
  contract_changes: Kies<
    "contract_changes",
    "id" | "contract_line_id" | "status" | "amount_incl_cents"
  >[];
  contract_installments: Kies<
    "contract_installments",
    | "id"
    | "contract_id"
    | "sequence"
    | "description"
    | "percentage_bp"
    | "amount_incl_cents"
    | "expected_date"
  >[];
  cost_documents: Kies<
    "cost_documents",
    | "id"
    | "type"
    | "status"
    | "supplier_id"
    | "contract_id"
    | "installment_id"
    | "document_date"
    | "due_date"
  >[];
  cost_lines: Kies<
    "cost_lines",
    | "id"
    | "cost_document_id"
    | "category_id"
    | "contract_id"
    | "contract_line_id"
    | "amount_incl_cents"
  >[];
  rooms: Kies<"rooms", "id" | "name" | "sort_order">[];
  room_allocations: Kies<
    "room_allocations",
    "room_id" | "cost_line_id" | "contract_line_id" | "share_bp"
  >[];
  payments: Kies<
    "payments",
    "id" | "cost_document_id" | "funding_source_id" | "amount_cents" | "paid_on"
  >[];
  funding_sources: Kies<
    "funding_sources",
    "id" | "parent_source_id" | "type" | "name" | "amount_cents"
  >[];
};

export function naarInvoer(r: DatabaseRijen): ProjectInvoer {
  return {
    categorieen: r.categories.map((c) => ({
      id: c.id,
      parentId: c.parent_id,
      naam: c.name,
      volgorde: c.sort_order,
      afgesloten: c.is_closed,
    })),
    budgetRegels: r.budget_lines.map((b) => ({
      id: b.id,
      categorieId: b.category_id,
      bedrag: b.amount_incl_cents,
    })),
    contracten: r.contracts.map((c) => ({
      id: c.id,
      titel: c.title,
      leverancierId: c.supplier_id,
      status: c.status,
    })),
    contractRegels: r.contract_lines.map((l) => ({
      id: l.id,
      contractId: l.contract_id,
      categorieId: l.category_id,
      omschrijving: l.description,
      bedrag: l.amount_incl_cents,
    })),
    wijzigingen: r.contract_changes.map((w) => ({
      id: w.id,
      contractRegelId: w.contract_line_id,
      status: w.status,
      bedrag: w.amount_incl_cents,
    })),
    termijnen: r.contract_installments.map((t) => ({
      id: t.id,
      contractId: t.contract_id,
      volgorde: t.sequence,
      omschrijving: t.description,
      percentageBp: t.percentage_bp,
      bedrag: t.amount_incl_cents,
      verwachteDatum: t.expected_date,
    })),
    documenten: r.cost_documents.map((d) => ({
      id: d.id,
      type: d.type,
      status: d.status,
      leverancierId: d.supplier_id,
      contractId: d.contract_id,
      termijnId: d.installment_id,
      documentDatum: d.document_date,
      vervalDatum: d.due_date,
    })),
    kostenRegels: r.cost_lines.map((k) => ({
      id: k.id,
      documentId: k.cost_document_id,
      categorieId: k.category_id,
      contractId: k.contract_id,
      contractRegelId: k.contract_line_id,
      bedrag: k.amount_incl_cents,
    })),
    ruimtes: r.rooms.map((x) => ({
      id: x.id,
      naam: x.name,
      volgorde: x.sort_order,
    })),
    ruimteVerdelingen: r.room_allocations.map((v) => ({
      ruimteId: v.room_id,
      kostenRegelId: v.cost_line_id,
      contractRegelId: v.contract_line_id,
      aandeelBp: v.share_bp,
    })),
    betalingen: r.payments.map((b) => ({
      id: b.id,
      documentId: b.cost_document_id,
      bronId: b.funding_source_id,
      bedrag: b.amount_cents,
      datum: b.paid_on,
    })),
    bronnen: r.funding_sources.map((f) => ({
      id: f.id,
      parentId: f.parent_source_id,
      type: f.type,
      naam: f.name,
      bedrag: f.amount_cents,
    })),
  };
}
