/**
 * Hulpjes om in tests compact een project op te bouwen.
 * Alle bedragen in de helpers zijn in euro's en worden omgezet naar centen.
 */
import type {
  BetalingInvoer,
  BronInvoer,
  CategorieInvoer,
  ContractInvoer,
  ContractRegelInvoer,
  DocumentInvoer,
  KostenRegelInvoer,
  ProjectInvoer,
  TermijnInvoer,
  WijzigingInvoer,
} from "./types";

export const VANDAAG = { vandaag: "2026-11-26" };

export const euro = (bedrag: number) => Math.round(bedrag * 100);

export function project(delen: Partial<ProjectInvoer> = {}): ProjectInvoer {
  return {
    categorieen: [],
    budgetRegels: [],
    contracten: [],
    contractRegels: [],
    wijzigingen: [],
    termijnen: [],
    documenten: [],
    kostenRegels: [],
    ruimtes: [],
    ruimteVerdelingen: [],
    betalingen: [],
    bronnen: [],
    ...delen,
  };
}

export const categorie = (
  id: string,
  extra: Partial<CategorieInvoer> = {},
): CategorieInvoer => ({
  id,
  parentId: null,
  naam: id,
  volgorde: 0,
  afgesloten: false,
  ...extra,
});

export const budget = (categorieId: string, bedrag: number) => ({
  id: `budget-${categorieId}-${bedrag}`,
  categorieId,
  bedrag: euro(bedrag),
});

export const contract = (
  id: string,
  extra: Partial<ContractInvoer> = {},
): ContractInvoer => ({
  id,
  titel: id,
  leverancierId: null,
  status: "actief",
  ...extra,
});

export const contractRegel = (
  id: string,
  contractId: string,
  categorieId: string,
  bedrag: number,
): ContractRegelInvoer => ({
  id,
  contractId,
  categorieId,
  omschrijving: id,
  bedrag: euro(bedrag),
});

export const wijziging = (
  id: string,
  contractRegelId: string,
  bedrag: number,
  status: WijzigingInvoer["status"] = "akkoord",
): WijzigingInvoer => ({ id, contractRegelId, bedrag: euro(bedrag), status });

export const termijn = (
  id: string,
  contractId: string,
  volgorde: number,
  percentage: number,
): TermijnInvoer => ({
  id,
  contractId,
  volgorde,
  omschrijving: `Termijn ${volgorde}`,
  percentageBp: Math.round(percentage * 100),
  bedrag: null,
  verwachteDatum: null,
});

export const document = (
  id: string,
  extra: Partial<DocumentInvoer> = {},
): DocumentInvoer => ({
  id,
  type: "factuur",
  status: "geboekt",
  leverancierId: null,
  contractId: null,
  termijnId: null,
  documentDatum: "2026-11-01",
  vervalDatum: null,
  ...extra,
});

export const kostenRegel = (
  id: string,
  documentId: string,
  bedrag: number,
  koppeling: Partial<
    Pick<KostenRegelInvoer, "categorieId" | "contractId" | "contractRegelId">
  >,
): KostenRegelInvoer => ({
  id,
  documentId,
  bedrag: euro(bedrag),
  categorieId: null,
  contractId: null,
  contractRegelId: null,
  ...koppeling,
});

export const betaling = (
  id: string,
  documentId: string,
  bedrag: number,
  extra: Partial<BetalingInvoer> = {},
): BetalingInvoer => ({
  id,
  documentId,
  bedrag: euro(bedrag),
  bronId: null,
  datum: "2026-11-10",
  ...extra,
});

export const bron = (
  id: string,
  type: BronInvoer["type"],
  bedrag: number,
  parentId: string | null = null,
): BronInvoer => ({ id, type, naam: id, bedrag: euro(bedrag), parentId });
