/**
 * DEMO-GEGEVENS — verzonnen project om het ontwerp te beoordelen.
 *
 * Sinds fase 3 is dit een volledig project in de vorm van de database
 * (categorieën, contracten, termijnfacturen, bonnen, betalingen, hypotheek
 * met bouwdepot). Het dashboard rekent het door met dezelfde rekenlogica
 * (lib/finance) als straks de echte gegevens.
 *
 * Alle namen en bedragen zijn verzonnen.
 */
import type {
  BetalingInvoer,
  DocumentInvoer,
  KostenRegelInvoer,
  ProjectInvoer,
  TermijnInvoer,
} from "@/lib/finance";

const euro = (bedrag: number) => Math.round(bedrag * 100);

export const DEMO_VANDAAG = "2026-11-26";

export const demoLeveranciers: Record<string, string> = {
  vanrijn: "Bouwbedrijf Van Rijn",
  lindeboom: "Keukenstudio Lindeboom",
  sanitair: "Sanitairhuis Oost",
  kwast: "Schildersbedrijf De Kwast",
  notaris: "Notariskantoor Aan de Gracht",
  woonwarenhuis: "Woonwarenhuis Noord",
  lampen: "Lampenhuis Centrum",
  hamer: "Bouwmarkt De Hamer",
};

// -----------------------------------------------------------------------------
// Aanneemovereenkomst: termijnschema en termijnfacturen
// -----------------------------------------------------------------------------
const AANNEEMSOM = 368_000;
const schema: [string, number][] = [
  ["start bouw", 15],
  ["fundering gereed", 10],
  ["begane grondvloer", 5],
  ["eerste verdiepingsvloer", 5],
  ["ruwbouw gereed", 10],
  ["gevels gereed", 10],
  ["kozijnen geplaatst", 5],
  ["dakconstructie gereed", 10],
  ["afbouw", 15],
  ["oplevering", 15],
];
const termijnen: TermijnInvoer[] = schema.map(([wat, pct], i) => ({
  id: `t${i + 1}`,
  contractId: "aanneem",
  volgorde: i + 1,
  omschrijving: `Termijn ${i + 1} · ${wat}`,
  percentageBp: pct * 100,
  bedrag: null,
  verwachteDatum: null,
}));

// [termijn, factuurdatum, vervaldatum, betaaldatum | null, bron]
const termijnFacturen: [number, string, string, string | null, string][] = [
  [1, "2026-04-02", "2026-04-16", "2026-04-15", "rest"],
  [2, "2026-05-06", "2026-05-20", "2026-05-19", "rest"],
  [3, "2026-06-03", "2026-06-17", "2026-06-16", "rest"],
  [4, "2026-07-01", "2026-07-15", "2026-07-14", "rest"],
  [5, "2026-09-02", "2026-09-16", "2026-09-15", "depot"],
  [6, "2026-10-01", "2026-10-15", "2026-10-14", "depot"],
  [7, "2026-11-04", "2026-11-18", "2026-11-17", "depot"],
  [8, "2026-11-17", "2026-12-01", null, "depot"],
];

const documenten: DocumentInvoer[] = [];
const kostenRegels: KostenRegelInvoer[] = [];
const betalingen: BetalingInvoer[] = [];

/** Metadata voor weergave (leverancier, omschrijving, geplande betaalbron). */
export const demoDocumentInfo: Record<
  string,
  { leverancier: string; omschrijving: string; betalenUit: string }
> = {};

for (const [nr, datum, verval, betaald, bron] of termijnFacturen) {
  const id = `f-t${nr}`;
  const bedrag = euro((AANNEEMSOM * schema[nr - 1][1]) / 100);
  documenten.push({
    id,
    type: "termijnfactuur",
    status: "geboekt",
    leverancierId: "vanrijn",
    contractId: "aanneem",
    termijnId: `t${nr}`,
    documentDatum: datum,
    vervalDatum: verval,
  });
  kostenRegels.push({
    id: `${id}-r`,
    documentId: id,
    categorieId: null,
    contractId: "aanneem",
    contractRegelId: null,
    bedrag,
  });
  if (betaald) {
    betalingen.push({
      id: `${id}-p`,
      documentId: id,
      bronId: bron,
      bedrag,
      datum: betaald,
    });
  }
  demoDocumentInfo[id] = {
    leverancier: demoLeveranciers.vanrijn,
    omschrijving: termijnen[nr - 1].omschrijving,
    betalenUit: bron === "depot" ? "Bouwdepot" : "Overige hypotheekruimte",
  };
}

// -----------------------------------------------------------------------------
// Overige documenten
// -----------------------------------------------------------------------------
type Doc = {
  id: string;
  type: DocumentInvoer["type"];
  status?: DocumentInvoer["status"];
  leverancier: string;
  omschrijving: string;
  datum: string;
  verval?: string;
  contractId?: string;
  termijnId?: string;
  regels: Omit<KostenRegelInvoer, "id" | "documentId">[];
  betaald?: { datum: string; bron: string; bedrag?: number };
  betalenUit?: string;
};

const los = (categorieId: string, bedrag: number) => ({
  categorieId,
  contractId: null,
  contractRegelId: null,
  bedrag: euro(bedrag),
});

const overige: Doc[] = [
  {
    id: "f-notaris",
    type: "factuur",
    leverancier: "notaris",
    omschrijving: "Akte van levering en hypotheekakte",
    datum: "2026-04-01",
    verval: "2026-04-01",
    regels: [los("notaris", 6_280)],
    betaald: { datum: "2026-04-01", bron: "eigen" },
  },
  {
    id: "bon-woonwarenhuis",
    type: "bon",
    leverancier: "woonwarenhuis",
    omschrijving: "Kassabon meubels",
    datum: "2026-07-18",
    regels: [los("inrichting", 1_899), los("inrichting", 1_288)],
    betaald: { datum: "2026-07-18", bron: "eigen" },
  },
  {
    id: "f-keuken-aanbetaling",
    type: "termijnfactuur",
    leverancier: "lindeboom",
    omschrijving: "Aanbetaling keuken (30%)",
    datum: "2026-08-12",
    verval: "2026-08-26",
    contractId: "keuken",
    termijnId: "k1",
    regels: [
      {
        categorieId: null,
        contractId: "keuken",
        contractRegelId: null,
        bedrag: euro(7_905),
      },
    ],
    betaald: { datum: "2026-08-14", bron: "eigen" },
  },
  {
    id: "f-mw012",
    type: "factuur",
    leverancier: "vanrijn",
    omschrijving: "Meerwerk MW-012 · verplaatsen binnenwand",
    datum: "2026-08-04",
    verval: "2026-09-03",
    regels: [
      {
        categorieId: null,
        contractId: "meerwerk",
        contractRegelId: "cl-meerwerk",
        bedrag: euro(6_300),
      },
    ],
    betaald: { datum: "2026-08-20", bron: "eigen" },
  },
  {
    id: "f-mw014",
    type: "factuur",
    leverancier: "vanrijn",
    omschrijving: "Meerwerk MW-014 · extra wandcontactdozen",
    datum: "2026-11-10",
    verval: "2026-12-10",
    regels: [
      {
        categorieId: null,
        contractId: "meerwerk",
        contractRegelId: "cl-meerwerk",
        bedrag: euro(3_500),
      },
    ],
    betalenUit: "Eigen geld",
  },
  {
    id: "bon-lampen-1",
    type: "bon",
    leverancier: "lampen",
    omschrijving: "Kassabon verlichting",
    datum: "2026-11-05",
    regels: [los("verlichting", 790)],
    betaald: { datum: "2026-11-05", bron: "eigen" },
  },
  {
    id: "bon-lampen-2",
    type: "bon",
    leverancier: "lampen",
    omschrijving: "Kassabon verlichting",
    datum: "2026-11-19",
    regels: [los("verlichting", 450)],
    betaald: { datum: "2026-11-19", bron: "eigen" },
  },
  // Nog te controleren (tellen NIET mee in de berekeningen):
  {
    id: "c-woonwarenhuis",
    type: "bon",
    status: "te_controleren",
    leverancier: "woonwarenhuis",
    omschrijving: "Kassabon",
    datum: "2026-11-24",
    regels: [
      los("inrichting", 412.9),
      los("raamdecoratie", 149.95),
      los("verlichting", 80),
    ],
  },
  {
    id: "c-hamer",
    type: "bon",
    status: "te_controleren",
    leverancier: "hamer",
    omschrijving: "Kassabon",
    datum: "2026-11-25",
    regels: [
      los("verlichting", 23.95),
      los("schilderwerk", 89.5),
      los("schilderwerk", 31.2),
      los("tuin", 24.9),
      los("onvoorzien", 17.85),
    ],
  },
  {
    id: "c-lindeboom",
    type: "factuur",
    status: "te_controleren",
    leverancier: "lindeboom",
    omschrijving: "Factuur 2026-118",
    datum: "2026-11-25",
    contractId: "keuken",
    regels: [
      {
        categorieId: null,
        contractId: "keuken",
        contractRegelId: null,
        bedrag: euro(7_905),
      },
    ],
  },
];

for (const d of overige) {
  documenten.push({
    id: d.id,
    type: d.type,
    status: d.status ?? "geboekt",
    leverancierId: d.leverancier,
    contractId: d.contractId ?? null,
    termijnId: d.termijnId ?? null,
    documentDatum: d.datum,
    vervalDatum: d.verval ?? null,
  });
  d.regels.forEach((r, i) =>
    kostenRegels.push({ id: `${d.id}-r${i + 1}`, documentId: d.id, ...r }),
  );
  if (d.betaald) {
    betalingen.push({
      id: `${d.id}-p`,
      documentId: d.id,
      bronId: d.betaald.bron,
      bedrag: d.regels.reduce((a, r) => a + r.bedrag, 0),
      datum: d.betaald.datum,
    });
  }
  demoDocumentInfo[d.id] = {
    leverancier: demoLeveranciers[d.leverancier],
    omschrijving: d.omschrijving,
    betalenUit: d.betalenUit ?? "Eigen geld",
  };
}

// -----------------------------------------------------------------------------
// Het volledige demo-project
// -----------------------------------------------------------------------------
const hoofd = (id: string, naam: string, volgorde: number) => ({
  id,
  parentId: null,
  naam,
  volgorde,
  afgesloten: false,
});
const blad = (
  id: string,
  parentId: string,
  naam: string,
  volgorde: number,
  afgesloten = false,
) => ({
  id,
  parentId,
  naam,
  volgorde,
  afgesloten,
});
const budget = (categorieId: string, bedrag: number) => ({
  id: `b-${categorieId}`,
  categorieId,
  bedrag: euro(bedrag),
});
const regel = (
  id: string,
  contractId: string,
  categorieId: string,
  bedrag: number,
) => ({
  id,
  contractId,
  categorieId,
  omschrijving: id,
  bedrag: euro(bedrag),
});

export const demoInvoer: ProjectInvoer = {
  categorieen: [
    hoofd("woning", "Woning", 1),
    blad("aanneemsom", "woning", "Koop-/aanneemsom", 1),
    blad("meerwerk", "woning", "Meerwerk aannemer", 2),
    hoofd("afbouw", "Afbouw", 2),
    blad("keuken", "afbouw", "Keuken", 1),
    blad("badkamer", "afbouw", "Badkamer & sanitair", 2),
    blad("vloeren", "afbouw", "Vloeren", 3),
    blad("schilderwerk", "afbouw", "Schilder- & stucwerk", 4),
    blad("verlichting", "afbouw", "Verlichting & elektra", 5),
    hoofd("buiten", "Buiten & inrichting", 3),
    blad("raamdecoratie", "buiten", "Raamdecoratie", 1),
    blad("inrichting", "buiten", "Inrichting & meubels", 2),
    blad("tuin", "buiten", "Tuin & bestrating", 3),
    hoofd("bijkomend", "Bijkomend", 4),
    blad("notaris", "bijkomend", "Notaris & financiering", 1, true),
    blad("onvoorzien", "bijkomend", "Onvoorzien", 2),
  ],
  budgetRegels: [
    budget("aanneemsom", 368_000),
    budget("meerwerk", 18_000),
    budget("keuken", 24_000),
    budget("badkamer", 15_500),
    budget("vloeren", 12_500),
    budget("schilderwerk", 6_000),
    budget("verlichting", 3_500),
    budget("raamdecoratie", 4_500),
    budget("inrichting", 12_000),
    budget("tuin", 9_000),
    budget("notaris", 7_500),
    budget("onvoorzien", 4_500),
  ],
  contracten: [
    {
      id: "aanneem",
      titel: "Aanneemovereenkomst",
      leverancierId: "vanrijn",
      status: "actief",
    },
    {
      id: "meerwerk",
      titel: "Meerwerkopties",
      leverancierId: "vanrijn",
      status: "actief",
    },
    {
      id: "keuken",
      titel: "Keuken",
      leverancierId: "lindeboom",
      status: "actief",
    },
    {
      id: "badkamer",
      titel: "Badkamer en sanitair",
      leverancierId: "sanitair",
      status: "actief",
    },
    {
      id: "schilder",
      titel: "Schilder- en stucwerk",
      leverancierId: "kwast",
      status: "actief",
    },
  ],
  contractRegels: [
    regel("cl-aanneem", "aanneem", "aanneemsom", AANNEEMSOM),
    regel("cl-meerwerk", "meerwerk", "meerwerk", 19_800),
    regel("cl-keuken", "keuken", "keuken", 26_350),
    regel("cl-badkamer", "badkamer", "badkamer", 14_200),
    regel("cl-schilder", "schilder", "schilderwerk", 5_650),
  ],
  wijzigingen: [
    {
      id: "mw016",
      contractRegelId: "cl-meerwerk",
      status: "akkoord",
      bedrag: euro(1_650),
    },
    {
      id: "mw017",
      contractRegelId: "cl-meerwerk",
      status: "voorgesteld",
      bedrag: euro(850),
    },
  ],
  termijnen: [
    ...termijnen,
    {
      id: "k1",
      contractId: "keuken",
      volgorde: 1,
      omschrijving: "Aanbetaling",
      percentageBp: 3_000,
      bedrag: null,
      verwachteDatum: "2026-08-12",
    },
    {
      id: "k2",
      contractId: "keuken",
      volgorde: 2,
      omschrijving: "Levering",
      percentageBp: 6_000,
      bedrag: null,
      verwachteDatum: "2027-04-15",
    },
    {
      id: "k3",
      contractId: "keuken",
      volgorde: 3,
      omschrijving: "Montage gereed",
      percentageBp: 1_000,
      bedrag: null,
      verwachteDatum: "2027-05-20",
    },
  ],
  documenten,
  kostenRegels,
  ruimtes: [
    { id: "r-keuken", naam: "Keuken", volgorde: 1 },
    { id: "r-woonkamer", naam: "Woonkamer", volgorde: 2 },
    { id: "r-slaapkamer", naam: "Slaapkamer 1", volgorde: 3 },
    { id: "r-badkamer", naam: "Badkamer", volgorde: 4 },
  ],
  ruimteVerdelingen: [
    {
      ruimteId: "r-keuken",
      contractRegelId: "cl-keuken",
      kostenRegelId: null,
      aandeelBp: 10_000,
    },
    {
      ruimteId: "r-badkamer",
      contractRegelId: "cl-badkamer",
      kostenRegelId: null,
      aandeelBp: 10_000,
    },
    {
      ruimteId: "r-woonkamer",
      kostenRegelId: "bon-woonwarenhuis-r1",
      contractRegelId: null,
      aandeelBp: 10_000,
    },
    {
      ruimteId: "r-slaapkamer",
      kostenRegelId: "bon-woonwarenhuis-r2",
      contractRegelId: null,
      aandeelBp: 10_000,
    },
  ],
  betalingen,
  bronnen: [
    {
      id: "hyp",
      parentId: null,
      type: "hypotheek",
      naam: "Hypotheek",
      bedrag: euro(400_000),
    },
    {
      id: "rest",
      parentId: "hyp",
      type: "overige_hypotheekruimte",
      naam: "Overige hypotheekruimte",
      bedrag: euro(140_000),
    },
    {
      id: "depot",
      parentId: "hyp",
      type: "bouwdepot",
      naam: "Bouwdepot",
      bedrag: euro(260_000),
    },
    {
      id: "eigen",
      parentId: null,
      type: "eigen_geld",
      naam: "Eigen geld",
      bedrag: euro(95_000),
    },
  ],
};

// -----------------------------------------------------------------------------
// Alleen voor weergave (nog geen eigen tabel of berekening)
// -----------------------------------------------------------------------------
export type DemoControle = {
  id: string;
  titel: string;
  leverancier: string;
  bedrag: number;
  regels: number;
  punten: {
    soort: "ontbreekt" | "klopt-niet" | "onzeker" | "duplicaat";
    tekst: string;
  }[];
};

/** AI-voorstellen ter controle; bedragen gelijk aan de documenten hierboven. */
export const demoTeControleren: DemoControle[] = [
  {
    id: "c-woonwarenhuis",
    titel: "Kassabon",
    leverancier: demoLeveranciers.woonwarenhuis,
    bedrag: euro(642.85),
    regels: 3,
    punten: [{ soort: "onzeker", tekst: "Ruimte bij regel 2 onzeker" }],
  },
  {
    id: "c-hamer",
    titel: "Kassabon",
    leverancier: demoLeveranciers.hamer,
    bedrag: euro(187.4),
    regels: 5,
    punten: [{ soort: "klopt-niet", tekst: "BTW-totaal wijkt € 0,42 af" }],
  },
  {
    id: "c-lindeboom",
    titel: "Factuur 2026-118",
    leverancier: demoLeveranciers.lindeboom,
    bedrag: euro(7_905),
    regels: 1,
    punten: [{ soort: "duplicaat", tekst: "Lijkt op al geboekte factuur" }],
  },
];

export const demoActiviteit = [
  {
    id: "a1",
    wie: "Sanne",
    wat: "heeft offerte Vloerenhuis Oost toegevoegd",
    bedrag: euro(11_870),
    wanneer: "vandaag, 10:42",
  },
  {
    id: "a2",
    wie: "Thomas",
    wat: "heeft termijn 7 als betaald geregistreerd",
    bedrag: euro(18_400),
    wanneer: "17-11-2026",
  },
  {
    id: "a3",
    wie: "Sanne",
    wat: "heeft meerwerk MW-016 goedgekeurd",
    bedrag: euro(1_650),
    wanneer: "13-11-2026",
  },
  {
    id: "a4",
    wie: "Thomas",
    wat: "heeft categorie Notaris & financiering afgesloten",
    bedrag: null,
    wanneer: "20-04-2026",
  },
];
