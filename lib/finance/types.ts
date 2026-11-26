/**
 * Invoer- en uitvoertypes van de rekenlogica (zie docs/ARCHITECTUUR.md § 3).
 *
 * Alle bedragen zijn hele centen INCLUSIEF BTW (keuze van de opdrachtgever).
 * De invoer is een platte weergave van de databasetabellen; de vertaling
 * vanuit de database staat in ./uit-database.ts.
 */

/** Bedrag in hele centen (integer). */
export type Cent = number;

export type CategorieInvoer = {
  id: string;
  parentId: string | null;
  naam: string;
  volgorde: number;
  afgesloten: boolean;
};

export type BudgetRegelInvoer = {
  id: string;
  categorieId: string;
  bedrag: Cent;
};

export type ContractStatus = "actief" | "afgerond" | "geannuleerd";

export type ContractInvoer = {
  id: string;
  titel: string;
  leverancierId: string | null;
  status: ContractStatus;
};

export type ContractRegelInvoer = {
  id: string;
  contractId: string;
  categorieId: string;
  omschrijving: string;
  bedrag: Cent;
};

export type WijzigingStatus = "voorgesteld" | "akkoord" | "afgewezen";

/** Meer- (+) of minderwerk (−) op een contractregel. */
export type WijzigingInvoer = {
  id: string;
  contractRegelId: string;
  status: WijzigingStatus;
  bedrag: Cent;
};

/** Termijn uit een termijnschema: óf een percentage, óf een vast bedrag. */
export type TermijnInvoer = {
  id: string;
  contractId: string;
  volgorde: number;
  omschrijving: string;
  percentageBp: number | null;
  bedrag: Cent | null;
  verwachteDatum: string | null;
};

export type DocumentType =
  "factuur" | "termijnfactuur" | "eindfactuur" | "creditnota" | "bon";

export type DocumentStatus =
  "concept" | "te_controleren" | "geboekt" | "vervallen";

export type DocumentInvoer = {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  leverancierId: string | null;
  contractId: string | null;
  termijnId: string | null;
  documentDatum: string;
  vervalDatum: string | null;
};

/**
 * Kostenregel op een document. Drie mogelijkheden:
 *  - aan een contractregel (contractRegelId): categorie volgt de contractregel;
 *  - aan een heel contract (contractId, geen regel): naar rato verdeeld over
 *    de contractregels (bij een categorie: over de regels in die categorie);
 *  - los (alleen categorieId).
 */
export type KostenRegelInvoer = {
  id: string;
  documentId: string;
  categorieId: string | null;
  contractId: string | null;
  contractRegelId: string | null;
  bedrag: Cent;
};

export type RuimteInvoer = { id: string; naam: string; volgorde: number };

/** Aandeel van een kosten- óf contractregel in een ruimte (basispunten). */
export type RuimteVerdelingInvoer = {
  ruimteId: string;
  kostenRegelId: string | null;
  contractRegelId: string | null;
  aandeelBp: number;
};

export type BetalingInvoer = {
  id: string;
  documentId: string;
  bronId: string | null;
  bedrag: Cent;
  datum: string;
};

export type FinancieringsType =
  | "eigen_geld"
  | "hypotheek"
  | "schenking"
  | "lening"
  | "overig"
  | "bouwdepot"
  | "overige_hypotheekruimte";

export type BronInvoer = {
  id: string;
  parentId: string | null;
  type: FinancieringsType;
  naam: string;
  bedrag: Cent;
};

export type ProjectInvoer = {
  categorieen: CategorieInvoer[];
  budgetRegels: BudgetRegelInvoer[];
  contracten: ContractInvoer[];
  contractRegels: ContractRegelInvoer[];
  wijzigingen: WijzigingInvoer[];
  termijnen: TermijnInvoer[];
  documenten: DocumentInvoer[];
  kostenRegels: KostenRegelInvoer[];
  ruimtes: RuimteInvoer[];
  ruimteVerdelingen: RuimteVerdelingInvoer[];
  betalingen: BetalingInvoer[];
  bronnen: BronInvoer[];
};

// -----------------------------------------------------------------------------
// Uitvoer
// -----------------------------------------------------------------------------

/** De kerncijfers, per categorie, per ruimte en voor het hele project. */
export type Cijfers = {
  /** Wat we van plan zijn uit te geven. */
  budget: Cent;
  /** Toegezegd in contracten (incl. goedgekeurd meer-/minderwerk). */
  gecontracteerd: Cent;
  /** Geboekte facturen en bonnen. */
  gefactureerd: Cent;
  /** Betaald op geboekte documenten. */
  betaald: Cent;
  /** Gefactureerd − betaald. */
  openstaand: Cent;
  /** Prognose van contracten + losse kosten (V in § 3.4). */
  vastgelegd: Cent;
  /** Budget waarvoor nog niets is vastgelegd (R in § 3.4). */
  nogNietVastgelegd: Cent;
  /** Verwachte eindkosten: vastgelegd + nog niet vastgelegd. */
  prognose: Cent;
  /** Prognose − budget (positief = overschrijding). */
  afwijking: Cent;
  /** Nog te factureren op actieve contracten. */
  nogTeFactureren: Cent;
  /** Meer-/minderwerk dat nog niet is goedgekeurd (telt niet mee). */
  voorgesteldeWijzigingen: Cent;
  /** Documenten die nog gecontroleerd moeten worden (tellen niet mee). */
  inControle: Cent;
};

export type CategorieResultaat = {
  id: string;
  naam: string;
  parentId: string | null;
  diepte: number;
  isBlad: boolean;
  /** Zelf afgesloten of onder een afgesloten categorie. */
  afgesloten: boolean;
  eigenAfgesloten: boolean;
  /** Eigen bedragen plus die van alle subcategorieën. */
  cijfers: Cijfers;
  documentenInControle: number;
};

export type ContractRegelResultaat = {
  id: string;
  categorieId: string;
  omschrijving: string;
  /** C(l): contractregel + goedgekeurd meer-/minderwerk (0 bij geannuleerd). */
  gecontracteerd: Cent;
  /** F(l): direct + naar rato gefactureerd. */
  gefactureerd: Cent;
  /** P(l): prognose van deze regel. */
  prognose: Cent;
  betaald: Cent;
  nogTeFactureren: Cent;
  voorgesteldeWijzigingen: Cent;
};

export type TermijnStatus = "open" | "gefactureerd" | "deels";

export type TermijnResultaat = {
  id: string;
  volgorde: number;
  omschrijving: string;
  verwachtBedrag: Cent;
  verwachteDatum: string | null;
  gefactureerd: Cent;
  status: TermijnStatus;
};

export type ContractResultaat = {
  id: string;
  titel: string;
  status: ContractStatus;
  regels: ContractRegelResultaat[];
  gecontracteerd: Cent;
  gefactureerd: Cent;
  prognose: Cent;
  betaald: Cent;
  nogTeFactureren: Cent;
  /** Prognose − gecontracteerd (meerwerk boven de afspraak). */
  overschrijding: Cent;
  termijnen: TermijnResultaat[];
};

export type BetaalStatus = "open" | "deels" | "betaald" | "te_laat";

export type DocumentResultaat = {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  totaal: Cent;
  betaald: Cent;
  openstaand: Cent;
  /** Alleen voor geboekte documenten. */
  betaalStatus: BetaalStatus | null;
  vervalDatum: string | null;
  /** Dagen tot de vervaldatum (negatief = verlopen); null zonder datum. */
  dagenTotVervallen: number | null;
};

export type BronResultaat = {
  id: string;
  parentId: string | null;
  type: FinancieringsType;
  naam: string;
  bedrag: Cent;
  betaald: Cent;
  saldo: Cent;
  delen: BronResultaat[];
};

export type FinancieringResultaat = {
  /** Som van de hoofdbronnen; delen (bouwdepot) tellen niet extra mee. */
  totaalBeschikbaar: Cent;
  bronnen: BronResultaat[];
  betaaldZonderBron: Cent;
  /** Totaal beschikbaar − totale prognose. */
  ruimte: Cent;
  /** Totaal beschikbaar − al betaald. */
  beschikbaarNaBetalingen: Cent;
  /** Totale prognose − al betaald. */
  nogTeBetalen: Cent;
};

export type RuimteResultaat = {
  /** null = niet aan een ruimte toegewezen. */
  id: string | null;
  naam: string;
  gecontracteerd: Cent;
  gefactureerd: Cent;
  betaald: Cent;
  vastgelegd: Cent;
};

export type Melding = {
  soort: "waarschuwing" | "info";
  code:
    | "kostenregel_zonder_categorie"
    | "contract_zonder_regels"
    | "delen_wijken_af"
    | "kosten_zonder_budget"
    | "overbetaald";
  tekst: string;
  ids: string[];
};

export type ProjectResultaat = {
  cijfers: Cijfers;
  /** Kosten die niet aan een categorie te koppelen zijn (zou niet moeten). */
  onverdeeld: Cijfers;
  categorieen: CategorieResultaat[];
  contracten: ContractResultaat[];
  documenten: DocumentResultaat[];
  financiering: FinancieringResultaat;
  ruimtes: RuimteResultaat[];
  betalingenPerMaand: { maand: string; bedrag: Cent }[];
  meldingen: Melding[];
};
