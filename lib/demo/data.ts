/**
 * DEMO-GEGEVENS — uitsluitend voor het beoordelen van het ontwerp (fase 1).
 *
 * Alle namen, bedragen en documenten zijn verzonnen. Vanaf fase 2/3 komen de
 * gegevens uit Supabase en worden de berekeningen gedaan door `lib/finance`.
 * De kleine rekenhulp onderaan volgt de rekenregels uit docs/ARCHITECTUUR.md
 * (§ 3.4) zodat de demo-cijfers onderling kloppen.
 *
 * Alle bedragen in hele centen, inclusief BTW.
 */

const euro = (bedrag: number) => Math.round(bedrag * 100);

export type DemoCategorie = {
  id: string;
  naam: string;
  groep: "Woning" | "Afbouw" | "Buiten & inrichting" | "Bijkomend";
  budget: number;
  gecontracteerd: number;
  gefactureerd: number;
  betaald: number;
  /** Vastgelegd = prognose van contracten + losse kostenregels (§ 3.4, V). */
  vastgelegd: number;
  afgesloten: boolean;
};

export const demoProject = {
  naam: "Kavel 14 · De Nieuwe Erven",
  plaats: "Demo-stad",
  oplevering: "2027-05-15",
  bijgewerkt: "2026-11-26",
  gebruikers: [
    { naam: "Thomas", initialen: "TH", rol: "Eigenaar" },
    { naam: "Sanne", initialen: "SA", rol: "Eigenaar" },
  ],
};

export const demoCategorieen: DemoCategorie[] = [
  {
    id: "aanneemsom",
    naam: "Koop-/aanneemsom",
    groep: "Woning",
    budget: euro(368_000),
    gecontracteerd: euro(368_000),
    gefactureerd: euro(257_600),
    betaald: euro(220_800),
    vastgelegd: euro(368_000),
    afgesloten: false,
  },
  {
    id: "meerwerk",
    naam: "Meerwerk aannemer",
    groep: "Woning",
    budget: euro(18_000),
    gecontracteerd: euro(21_450),
    gefactureerd: euro(9_800),
    betaald: euro(6_300),
    vastgelegd: euro(21_450),
    afgesloten: false,
  },
  {
    id: "keuken",
    naam: "Keuken",
    groep: "Afbouw",
    budget: euro(24_000),
    gecontracteerd: euro(26_350),
    gefactureerd: euro(7_905),
    betaald: euro(7_905),
    vastgelegd: euro(26_350),
    afgesloten: false,
  },
  {
    id: "badkamer",
    naam: "Badkamer & sanitair",
    groep: "Afbouw",
    budget: euro(15_500),
    gecontracteerd: euro(14_200),
    gefactureerd: 0,
    betaald: 0,
    vastgelegd: euro(14_200),
    afgesloten: false,
  },
  {
    id: "vloeren",
    naam: "Vloeren",
    groep: "Afbouw",
    budget: euro(12_500),
    gecontracteerd: 0,
    gefactureerd: 0,
    betaald: 0,
    vastgelegd: 0,
    afgesloten: false,
  },
  {
    id: "schilderwerk",
    naam: "Schilder- & stucwerk",
    groep: "Afbouw",
    budget: euro(6_000),
    gecontracteerd: euro(5_650),
    gefactureerd: 0,
    betaald: 0,
    vastgelegd: euro(5_650),
    afgesloten: false,
  },
  {
    id: "verlichting",
    naam: "Verlichting & elektra",
    groep: "Afbouw",
    budget: euro(3_500),
    gecontracteerd: 0,
    gefactureerd: euro(1_240),
    betaald: euro(1_240),
    vastgelegd: euro(1_240),
    afgesloten: false,
  },
  {
    id: "raamdecoratie",
    naam: "Raamdecoratie",
    groep: "Buiten & inrichting",
    budget: euro(4_500),
    gecontracteerd: 0,
    gefactureerd: 0,
    betaald: 0,
    vastgelegd: 0,
    afgesloten: false,
  },
  {
    id: "inrichting",
    naam: "Inrichting & meubels",
    groep: "Buiten & inrichting",
    budget: euro(12_000),
    gecontracteerd: 0,
    gefactureerd: euro(3_187),
    betaald: euro(3_187),
    vastgelegd: euro(3_187),
    afgesloten: false,
  },
  {
    id: "tuin",
    naam: "Tuin & bestrating",
    groep: "Buiten & inrichting",
    budget: euro(9_000),
    gecontracteerd: 0,
    gefactureerd: 0,
    betaald: 0,
    vastgelegd: 0,
    afgesloten: false,
  },
  {
    id: "notaris",
    naam: "Notaris & financiering",
    groep: "Bijkomend",
    budget: euro(7_500),
    gecontracteerd: euro(6_280),
    gefactureerd: euro(6_280),
    betaald: euro(6_280),
    vastgelegd: euro(6_280),
    afgesloten: true,
  },
  {
    id: "onvoorzien",
    naam: "Onvoorzien",
    groep: "Bijkomend",
    budget: euro(4_500),
    gecontracteerd: 0,
    gefactureerd: 0,
    betaald: 0,
    vastgelegd: 0,
    afgesloten: false,
  },
];

/** Prognose per categorie volgens § 3.4: afgesloten → V, anders max(B, V). */
export function prognose(c: DemoCategorie): number {
  return c.afgesloten ? c.vastgelegd : Math.max(c.budget, c.vastgelegd);
}

const som = (f: (c: DemoCategorie) => number) =>
  demoCategorieen.reduce((totaal, c) => totaal + f(c), 0);

/**
 * Financiering volgens § 3.5: de hypotheek is één hoofdbron; bouwdepot en
 * overige hypotheekruimte zijn delen daarvan en tellen niet extra mee.
 */
export const demoFinanciering = {
  hoofdbronnen: [
    {
      id: "hypotheek",
      naam: "Hypotheek",
      bedrag: euro(400_000),
      delen: [
        {
          id: "overig",
          naam: "Overige hypotheekruimte",
          bedrag: euro(300_000),
          opgenomen: euro(300_000),
        },
        {
          id: "bouwdepot",
          naam: "Bouwdepot",
          bedrag: euro(100_000),
          opgenomen: euro(58_420),
        },
      ],
    },
    {
      id: "eigen-geld",
      naam: "Eigen geld",
      bedrag: euro(95_000),
      delen: [],
    },
  ],
};

export const demoTotalen = (() => {
  const budget = som((c) => c.budget);
  const totalePrognose = som(prognose);
  const gefactureerd = som((c) => c.gefactureerd);
  const betaald = som((c) => c.betaald);
  const gecontracteerd = som((c) => c.gecontracteerd);
  const financiering = demoFinanciering.hoofdbronnen.reduce(
    (t, b) => t + b.bedrag,
    0,
  );
  return {
    budget,
    prognose: totalePrognose,
    afwijking: totalePrognose - budget,
    gecontracteerd,
    gefactureerd,
    betaald,
    openstaand: gefactureerd - betaald,
    financiering,
    ruimte: financiering - totalePrognose,
  };
})();

/** Betaald per maand (som = totaal betaald). */
export const demoBetalingenPerMaand = [
  { maand: "2026-04", label: "apr", betaald: euro(61_480) },
  { maand: "2026-05", label: "mei", betaald: euro(36_800) },
  { maand: "2026-06", label: "jun", betaald: euro(18_400) },
  { maand: "2026-07", label: "jul", betaald: euro(21_587) },
  { maand: "2026-08", label: "aug", betaald: euro(14_205) },
  { maand: "2026-09", label: "sep", betaald: euro(36_800) },
  { maand: "2026-10", label: "okt", betaald: euro(36_800) },
  { maand: "2026-11", label: "nov", betaald: euro(19_640) },
];

export type DemoOpenPost = {
  id: string;
  leverancier: string;
  omschrijving: string;
  type: "Termijnfactuur" | "Factuur" | "Eindfactuur";
  openstaand: number;
  vervaldatum: string;
  dagenTotVervallen: number;
  bron: string;
};

/** Openstaande posten (som = totaal openstaand). */
export const demoOpenPosten: DemoOpenPost[] = [
  {
    id: "t7",
    leverancier: "Bouwbedrijf Van Rijn",
    omschrijving: "Termijn 7 · dakconstructie gereed",
    type: "Termijnfactuur",
    openstaand: euro(36_800),
    vervaldatum: "2026-12-01",
    dagenTotVervallen: 5,
    bron: "Bouwdepot",
  },
  {
    id: "mw14",
    leverancier: "Bouwbedrijf Van Rijn",
    omschrijving: "Meerwerk MW-014 · extra wandcontactdozen (restant)",
    type: "Factuur",
    openstaand: euro(3_500),
    vervaldatum: "2026-12-10",
    dagenTotVervallen: 14,
    bron: "Eigen geld",
  },
];

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

/** Documenten die nog gecontroleerd moeten worden — tellen NIET mee. */
export const demoTeControleren: DemoControle[] = [
  {
    id: "c1",
    titel: "Kassabon",
    leverancier: "Woonwarenhuis Noord",
    bedrag: euro(642.85),
    regels: 3,
    punten: [{ soort: "onzeker", tekst: "Ruimte bij regel 2 onzeker" }],
  },
  {
    id: "c2",
    titel: "Kassabon",
    leverancier: "Bouwmarkt De Hamer",
    bedrag: euro(187.4),
    regels: 5,
    punten: [{ soort: "klopt-niet", tekst: "BTW-totaal wijkt € 0,42 af" }],
  },
  {
    id: "c3",
    titel: "Factuur 2026-118",
    leverancier: "Keukenstudio Lindeboom",
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
    wat: "heeft termijn 6 als betaald geregistreerd",
    bedrag: euro(18_400),
    wanneer: "gisteren, 21:15",
  },
  {
    id: "a3",
    wie: "Sanne",
    wat: "heeft meerwerk MW-016 goedgekeurd",
    bedrag: euro(1_650),
    wanneer: "23-11-2026",
  },
  {
    id: "a4",
    wie: "Thomas",
    wat: "heeft categorie Notaris & financiering afgesloten",
    bedrag: null,
    wanneer: "20-11-2026",
  },
];
