/**
 * Zet de uitkomst van de rekenlogica om naar wat de dashboardonderdelen
 * tonen. Werkt nu met het demo-project; in fase 7 met de echte gegevens.
 */
import {
  berekenProject,
  type Cent,
  type Cijfers,
  type ProjectInvoer,
} from "@/lib/finance";
import { DEMO_VANDAAG, demoDocumentInfo, demoInvoer } from "./data";

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

const DOCUMENTTYPE = {
  factuur: "Factuur",
  termijnfactuur: "Termijnfactuur",
  eindfactuur: "Eindfactuur",
  creditnota: "Creditnota",
  bon: "Bon",
} as const;

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
  bron: string;
};

export function dashboardGegevens(
  invoer: ProjectInvoer,
  vandaag: string,
  info: Record<
    string,
    { leverancier: string; omschrijving: string; betalenUit: string }
  >,
) {
  const resultaat = berekenProject(invoer, { vandaag });

  const budgetRijen: BudgetRij[] = resultaat.categorieen
    .filter((c) => c.isBlad)
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
      omschrijving: info[d.id]?.omschrijving ?? DOCUMENTTYPE[d.type],
      type: DOCUMENTTYPE[d.type],
      openstaand: d.openstaand,
      vervaldatum: d.vervalDatum,
      dagenTotVervallen: d.dagenTotVervallen,
      bron: info[d.id]?.betalenUit ?? "",
    }));

  return { resultaat, budgetRijen, maanden, openPosten };
}

export const demoDashboard = () =>
  dashboardGegevens(demoInvoer, DEMO_VANDAAG, demoDocumentInfo);
