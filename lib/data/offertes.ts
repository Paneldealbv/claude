import "server-only";
import { cache } from "react";
import type { CategorieInvoer } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

export type QuoteStatus =
  "ontvangen" | "geaccepteerd" | "afgewezen" | "verlopen";

export type OfferteRegel = {
  id: string;
  omschrijving: string;
  categorieId: string | null;
  bedrag: number;
  btw: number;
};

export type Offerte = {
  id: string;
  titel: string;
  nummer: string | null;
  status: QuoteStatus;
  datum: string | null;
  geldigTot: string | null;
  leverancierId: string | null;
  bestandId: string | null;
  notities: string | null;
  regels: OfferteRegel[];
  totaal: number;
};

export type Leverancier = {
  id: string;
  naam: string;
  contactpersoon: string | null;
  email: string | null;
  telefoon: string | null;
  iban: string | null;
  kvk: string | null;
  btwNummer: string | null;
  notities: string | null;
};

export const laadLeveranciers = cache(
  async (projectId: string): Promise<Leverancier[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("suppliers")
      .select(
        "id, name, contact_person, email, phone, iban, kvk_number, vat_number, notes",
      )
      .eq("project_id", projectId)
      .order("name", { ascending: true });
    if (error)
      throw new Error(`Leveranciers ophalen mislukt: ${error.message}`);
    return (data ?? []).map((s) => ({
      id: s.id,
      naam: s.name,
      contactpersoon: s.contact_person,
      email: s.email,
      telefoon: s.phone,
      iban: s.iban,
      kvk: s.kvk_number,
      btwNummer: s.vat_number,
      notities: s.notes,
    }));
  },
);

export const laadOffertes = cache(
  async (projectId: string): Promise<Offerte[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quotes")
      .select(
        "id, title, quote_number, status, quote_date, valid_until, supplier_id, file_id, notes, created_at, quote_lines (id, description, category_id, amount_incl_cents, vat_rate_bp, sort_order)",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Offertes ophalen mislukt: ${error.message}`);
    return (data ?? []).map((q) => {
      const regels = [...(q.quote_lines ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => ({
          id: l.id,
          omschrijving: l.description,
          categorieId: l.category_id,
          bedrag: l.amount_incl_cents,
          btw: l.vat_rate_bp,
        }));
      return {
        id: q.id,
        titel: q.title,
        nummer: q.quote_number,
        status: q.status,
        datum: q.quote_date,
        geldigTot: q.valid_until,
        leverancierId: q.supplier_id,
        bestandId: q.file_id,
        notities: q.notes,
        regels,
        totaal: regels.reduce((a, r) => a + r.bedrag, 0),
      };
    });
  },
);

/**
 * Label per categorie ("Ouder › Kind"), in de volgorde van de budgetpagina:
 * hoofdcategorie, dan haar subcategorieën.
 */
export function categorieLabels(
  categorieen: CategorieInvoer[],
): Map<string, string> {
  const perId = new Map(categorieen.map((c) => [c.id, c]));
  const sleutel = (c: CategorieInvoer) => {
    const ouder = c.parentId ? perId.get(c.parentId) : undefined;
    return ouder
      ? { a: ouder.volgorde, b: ouder.naam, c: c.volgorde, d: c.naam }
      : { a: c.volgorde, b: c.naam, c: -1, d: "" };
  };
  const gesorteerd = [...categorieen].sort((x, y) => {
    const a = sleutel(x);
    const b = sleutel(y);
    return (
      a.a - b.a ||
      a.b.localeCompare(b.b, "nl") ||
      a.c - b.c ||
      a.d.localeCompare(b.d, "nl")
    );
  });
  return new Map(
    gesorteerd.map((c) => {
      const ouder = c.parentId ? perId.get(c.parentId) : undefined;
      return [c.id, ouder ? `${ouder.naam} › ${c.naam}` : c.naam];
    }),
  );
}

/** Eindcategorieën als keuzelijst, met de hoofdcategorie ervoor. */
export function categorieOpties(categorieen: CategorieInvoer[]) {
  const heeftKinderen = new Set(
    categorieen.map((c) => c.parentId).filter(Boolean),
  );
  return [...categorieLabels(categorieen)]
    .filter(([id]) => !heeftKinderen.has(id))
    .map(([id, label]) => ({ id, label }));
}
