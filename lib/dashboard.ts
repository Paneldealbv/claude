/**
 * Zet de uitkomst van de rekenlogica om naar wat de dashboardonderdelen
 * tonen. Dezelfde omzetting voor het echte project en voor het voorbeeld
 * (demo), zodat beide er precies hetzelfde uitzien.
 */
import type { Cent, Cijfers, ProjectResultaat } from "@/lib/finance";
import { DOCUMENT_TYPE } from "@/lib/labels";

const MAANDEN = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

export type BudgetRij = {
  id: string;
  naam: string;
  afgesloten: boolean;
  cijfers: Cijfers;
};

export type MaandPunt = { maand: string; label: string; betaald: Cent };

export type OpenPost = {
  id: string;
  leverancier: string;
  omschrijving: string;
  type: string;
  openstaand: Cent;
  vervaldatum: string | null;
  dagenTotVervallen: number | null;
  /** Waaruit betaald wordt (alleen in het voorbeeld bekend). */
  bron: string | null;
  href?: string;
};

export type ControleItem = {
  id: string;
  titel: string;
  leverancier: string;
  bedrag: number;
  /** Aantal regels (onbekend = niet tonen). */
  regels?: number;
  punten: {
    soort: "ontbreekt" | "klopt-niet" | "onzeker" | "duplicaat" | "status";
    tekst: string;
  }[];
  href?: string;
};

export type ActiviteitItem = {
  id: string;
  wie: string;
  wat: string;
  bedrag: number | null;
  wanneer: string;
  href?: string;
};

export type DocumentInfo = Record<
  string,
  { leverancier: string; omschrijving: string; betalenUit?: string | null }
>;

export function dashboardUitResultaat(
  resultaat: ProjectResultaat,
  info: DocumentInfo,
  { metLinks }: { metLinks: boolean },
) {
  // Alleen eindcategorieën waar iets in staat; lege categorieën zijn ruis.
  const budgetRijen: BudgetRij[] = resultaat.categorieen
    .filter(
      (c) =>
        c.isBlad &&
        (c.cijfers.budget !== 0 ||
          c.cijfers.prognose !== 0 ||
          c.cijfers.gefactureerd !== 0),
    )
    .map((c) => ({
      id: c.id,
      naam: c.naam,
      afgesloten: c.afgesloten,
      cijfers: c.cijfers,
    }));

  const maanden: MaandPunt[] = resultaat.betalingenPerMaand.map((m) => ({
    maand: m.maand,
    label: MAANDEN[Number(m.maand.slice(5, 7)) - 1],
    betaald: m.bedrag,
  }));

  const openPosten: OpenPost[] = resultaat.documenten
    .filter((d) => d.status === "geboekt" && d.openstaand !== 0)
    .sort((a, b) =>
      (a.vervalDatum ?? "9999").localeCompare(b.vervalDatum ?? "9999"),
    )
    .map((d) => ({
      id: d.id,
      leverancier: info[d.id]?.leverancier ?? "",
      omschrijving: info[d.id]?.omschrijving ?? DOCUMENT_TYPE[d.type].tekst,
      type: DOCUMENT_TYPE[d.type].tekst,
      openstaand: d.openstaand,
      vervaldatum: d.vervalDatum,
      dagenTotVervallen: d.dagenTotVervallen,
      bron: info[d.id]?.betalenUit ?? null,
      href: metLinks ? `/documenten/${d.id}` : undefined,
    }));

  return { budgetRijen, maanden, openPosten };
}
