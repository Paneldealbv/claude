import { describe, expect, it } from "vitest";
import { berekenProject } from "./bereken";
import {
  betaling,
  bron,
  budget,
  categorie,
  contract,
  contractRegel,
  document,
  euro,
  kostenRegel,
  project,
  termijn,
  VANDAAG,
  wijziging,
} from "./testdata";
import type { ProjectInvoer, ProjectResultaat } from "./types";

const reken = (p: ProjectInvoer) => berekenProject(p, VANDAAG);
const cat = (r: ProjectResultaat, id: string) => {
  const c = r.categorieen.find((x) => x.id === id);
  if (!c) throw new Error(`categorie ${id} ontbreekt`);
  return c.cijfers;
};

// -----------------------------------------------------------------------------
// § 3.3 — Controlevoorbeeld van de opdrachtgever
// -----------------------------------------------------------------------------
describe("offerte € 15.000 met drie termijnfacturen (§ 3.3)", () => {
  const basis = () =>
    project({
      categorieen: [categorie("keuken")],
      budgetRegels: [budget("keuken", 15_000)],
      contracten: [contract("k")],
      contractRegels: [contractRegel("kl", "k", "keuken", 15_000)],
    });
  const metTermijnen = (aantal: number) => {
    const p = basis();
    for (let i = 1; i <= aantal; i++) {
      p.documenten.push(
        document(`t${i}`, { type: "termijnfactuur", contractId: "k" }),
      );
      p.kostenRegels.push(
        kostenRegel(`t${i}-r`, `t${i}`, 5_000, { contractId: "k" }),
      );
    }
    return p;
  };

  it("na acceptatie: prognose = contract", () => {
    const k = reken(basis()).contracten[0];
    expect([k.gecontracteerd, k.gefactureerd, k.prognose]).toEqual([
      euro(15_000),
      0,
      euro(15_000),
    ]);
  });

  it("na termijn 1: prognose blijft € 15.000, nog te factureren € 10.000", () => {
    const r = reken(metTermijnen(1));
    expect(r.contracten[0].gefactureerd).toBe(euro(5_000));
    expect(r.contracten[0].prognose).toBe(euro(15_000));
    expect(r.contracten[0].nogTeFactureren).toBe(euro(10_000));
  });

  it("na drie termijnen: prognose € 15.000, NOOIT € 30.000", () => {
    const r = reken(metTermijnen(3));
    expect(r.contracten[0].gefactureerd).toBe(euro(15_000));
    expect(r.contracten[0].prognose).toBe(euro(15_000));
    expect(cat(r, "keuken").prognose).toBe(euro(15_000));
    expect(r.cijfers.prognose).toBe(euro(15_000));
    expect(r.cijfers.prognose).not.toBe(euro(30_000));
  });

  it("eindfactuur met € 800 meerwerk: prognose € 15.800", () => {
    const p = metTermijnen(3);
    p.documenten.push(
      document("eind", { type: "eindfactuur", contractId: "k" }),
    );
    p.kostenRegels.push(
      kostenRegel("eind-r", "eind", 800, { contractId: "k" }),
    );
    const r = reken(p);
    expect(r.contracten[0].gefactureerd).toBe(euro(15_800));
    expect(r.contracten[0].prognose).toBe(euro(15_800));
    expect(r.contracten[0].overschrijding).toBe(euro(800));
    expect(cat(r, "keuken").afwijking).toBe(euro(800));
  });

  it("afgerond met € 300 minderwerk (creditnota): contract € 14.700", () => {
    const p = metTermijnen(3);
    p.contracten[0].status = "afgerond";
    p.documenten.push(
      document("credit", { type: "creditnota", contractId: "k" }),
    );
    p.kostenRegels.push(
      kostenRegel("credit-r", "credit", -300, { contractId: "k" }),
    );
    const r = reken(p);
    expect(r.contracten[0].gefactureerd).toBe(euro(14_700));
    expect(r.contracten[0].prognose).toBe(euro(14_700));
    // Categorie nog open: prognose blijft minimaal het budget …
    expect(cat(r, "keuken").prognose).toBe(euro(15_000));
    // … en pas na afsluiten wordt de meevaller zichtbaar.
    p.categorieen[0].afgesloten = true;
    const na = reken(p);
    expect(cat(na, "keuken").prognose).toBe(euro(14_700));
    expect(cat(na, "keuken").afwijking).toBe(euro(-300));
  });
});

describe("prognose per contractregel, niet per contract (§ 3.3)", () => {
  it("regel A € 10.000 met € 12.000 gefactureerd, regel B € 5.000 open → € 17.000", () => {
    const r = reken(
      project({
        categorieen: [categorie("a"), categorie("b")],
        contracten: [contract("c")],
        contractRegels: [
          contractRegel("A", "c", "a", 10_000),
          contractRegel("B", "c", "b", 5_000),
        ],
        documenten: [document("f")],
        kostenRegels: [
          kostenRegel("f1", "f", 12_000, { contractRegelId: "A" }),
        ],
      }),
    );
    expect(r.contracten[0].prognose).toBe(euro(17_000));
    expect(cat(r, "a").vastgelegd).toBe(euro(12_000));
    expect(cat(r, "b").vastgelegd).toBe(euro(5_000));
  });

  it("termijnfactuur op contractniveau wordt naar rato verdeeld, tot op de cent", () => {
    const r = reken(
      project({
        categorieen: [categorie("ruwbouw"), categorie("installaties")],
        contracten: [contract("c")],
        contractRegels: [
          contractRegel("r1", "c", "ruwbouw", 200_000),
          contractRegel("r2", "c", "installaties", 100_000),
        ],
        documenten: [
          document("t", { type: "termijnfactuur", contractId: "c" }),
        ],
        kostenRegels: [kostenRegel("t1", "t", 10_000.01, { contractId: "c" })],
      }),
    );
    const [r1, r2] = r.contracten[0].regels;
    expect(r1.gefactureerd).toBe(666_667);
    expect(r2.gefactureerd).toBe(333_334);
    expect(r1.gefactureerd + r2.gefactureerd).toBe(euro(10_000.01));
  });

  it("contractniveau-regel met categorie: alleen over contractregels in die categorie", () => {
    const r = reken(
      project({
        categorieen: [categorie("ruwbouw"), categorie("keuken")],
        contracten: [contract("c")],
        contractRegels: [
          contractRegel("r1", "c", "ruwbouw", 200_000),
          contractRegel("r2", "c", "keuken", 20_000),
        ],
        documenten: [document("f")],
        kostenRegels: [
          kostenRegel("f1", "f", 1_000, {
            contractId: "c",
            categorieId: "keuken",
          }),
        ],
      }),
    );
    expect(r.contracten[0].regels.map((x) => x.gefactureerd)).toEqual([
      0,
      euro(1_000),
    ]);
  });

  it("goedgekeurd meerwerk telt mee in het contract, voorgesteld en afgewezen niet", () => {
    const r = reken(
      project({
        categorieen: [categorie("meerwerk")],
        contracten: [contract("c")],
        contractRegels: [contractRegel("l", "c", "meerwerk", 19_800)],
        wijzigingen: [
          wijziging("mw16", "l", 1_650, "akkoord"),
          wijziging("mw17", "l", 850, "voorgesteld"),
          wijziging("mw18", "l", 2_000, "afgewezen"),
          wijziging("mw19", "l", -400, "akkoord"),
        ],
      }),
    );
    expect(r.contracten[0].gecontracteerd).toBe(euro(21_050));
    expect(cat(r, "meerwerk").voorgesteldeWijzigingen).toBe(euro(850));
  });

  it("geannuleerd contract: geen toezegging, alleen gefactureerd telt", () => {
    const r = reken(
      project({
        categorieen: [categorie("tuin")],
        contracten: [contract("c", { status: "geannuleerd" })],
        contractRegels: [contractRegel("l", "c", "tuin", 9_000)],
        documenten: [document("f")],
        kostenRegels: [kostenRegel("f1", "f", 500, { contractRegelId: "l" })],
      }),
    );
    const k = r.contracten[0];
    expect([
      k.gecontracteerd,
      k.gefactureerd,
      k.prognose,
      k.nogTeFactureren,
    ]).toEqual([0, euro(500), euro(500), 0]);
  });
});

// -----------------------------------------------------------------------------
// § 3.4 — Categorieën
// -----------------------------------------------------------------------------
describe("categorieën (§ 3.4)", () => {
  it("open categorie: prognose is minimaal het budget; nog niet vastgelegd = rest", () => {
    const r = reken(
      project({
        categorieen: [categorie("badkamer")],
        budgetRegels: [budget("badkamer", 15_500)],
        contracten: [contract("c")],
        contractRegels: [contractRegel("l", "c", "badkamer", 14_200)],
      }),
    );
    expect(cat(r, "badkamer")).toMatchObject({
      vastgelegd: euro(14_200),
      nogNietVastgelegd: euro(1_300),
      prognose: euro(15_500),
      afwijking: 0,
    });
  });

  it("overschrijding: prognose = vastgelegd zodra dat boven het budget komt", () => {
    const r = reken(
      project({
        categorieen: [categorie("keuken")],
        budgetRegels: [budget("keuken", 24_000)],
        contracten: [contract("c")],
        contractRegels: [contractRegel("l", "c", "keuken", 26_350)],
      }),
    );
    expect(cat(r, "keuken")).toMatchObject({
      prognose: euro(26_350),
      afwijking: euro(2_350),
    });
  });

  it("hoofdcategorie telt subcategorieën op; afgesloten hoofdcategorie sluit ook de kinderen", () => {
    const p = project({
      categorieen: [
        categorie("afbouw"),
        categorie("keuken", { parentId: "afbouw" }),
        categorie("vloeren", { parentId: "afbouw" }),
      ],
      budgetRegels: [budget("keuken", 24_000), budget("vloeren", 12_500)],
      documenten: [document("bon")],
      kostenRegels: [
        kostenRegel("b1", "bon", 10_000, { categorieId: "vloeren" }),
      ],
    });
    let r = reken(p);
    expect(cat(r, "afbouw").budget).toBe(euro(36_500));
    expect(cat(r, "afbouw").prognose).toBe(euro(36_500));
    expect(r.categorieen.map((c) => [c.id, c.diepte, c.isBlad])).toEqual([
      ["afbouw", 0, false],
      ["keuken", 1, true],
      ["vloeren", 1, true],
    ]);

    p.categorieen[0].afgesloten = true;
    r = reken(p);
    expect(r.categorieen.find((c) => c.id === "vloeren")?.afgesloten).toBe(
      true,
    );
    expect(cat(r, "afbouw").prognose).toBe(euro(10_000));
    expect(cat(r, "afbouw").afwijking).toBe(euro(-26_500));
  });

  it("kosten zonder budget: afwijking = kosten, met een melding", () => {
    const r = reken(
      project({
        categorieen: [categorie("tuin")],
        documenten: [document("bon")],
        kostenRegels: [kostenRegel("b1", "bon", 250, { categorieId: "tuin" })],
      }),
    );
    expect(cat(r, "tuin")).toMatchObject({
      prognose: euro(250),
      afwijking: euro(250),
    });
    expect(r.meldingen.map((m) => m.code)).toContain("kosten_zonder_budget");
  });
});

// -----------------------------------------------------------------------------
// § 3.7 / 3.8 — Bonnen, statussen en betalingen
// -----------------------------------------------------------------------------
describe("documenten en betalingen", () => {
  const ikea = () =>
    project({
      categorieen: [
        categorie("keuken"),
        categorie("inrichting"),
        categorie("verlichting"),
      ],
      documenten: [document("ikea", { type: "bon" })],
      kostenRegels: [
        kostenRegel("i1", "ikea", 399.0, { categorieId: "keuken" }),
        kostenRegel("i2", "ikea", 1_299.0, { categorieId: "inrichting" }),
        kostenRegel("i3", "ikea", 89.95, { categorieId: "verlichting" }),
      ],
      betalingen: [betaling("p", "ikea", 1_787.95)],
    });

  it("één bon met regels in drie categorieën, één keer opgeslagen", () => {
    const r = reken(ikea());
    expect(cat(r, "keuken").gefactureerd).toBe(euro(399));
    expect(cat(r, "inrichting").gefactureerd).toBe(euro(1_299));
    expect(cat(r, "verlichting").gefactureerd).toBe(euro(89.95));
    expect(r.cijfers.gefactureerd).toBe(euro(1_787.95));
    expect(r.cijfers.betaald).toBe(euro(1_787.95));
    expect(r.documenten[0]).toMatchObject({
      totaal: euro(1_787.95),
      openstaand: 0,
      betaalStatus: "betaald",
    });
  });

  it("deelbetaling wordt naar rato over de regels verdeeld en telt exact op", () => {
    const p = ikea();
    p.betalingen = [betaling("p", "ikea", 1_000)];
    const r = reken(p);
    const delen = ["keuken", "inrichting", "verlichting"].map(
      (id) => cat(r, id).betaald,
    );
    expect(delen.reduce((a, b) => a + b, 0)).toBe(euro(1_000));
    expect(delen).toEqual([22_316, 72_653, 5_031]);
    expect(r.cijfers.openstaand).toBe(euro(787.95));
    expect(r.documenten[0].betaalStatus).toBe("deels");
  });

  it("alleen geboekte documenten tellen mee; in controle apart zichtbaar; vervallen genegeerd", () => {
    const r = reken(
      project({
        categorieen: [categorie("keuken")],
        documenten: [
          document("concept", { status: "concept" }),
          document("controle", { status: "te_controleren" }),
          document("vervallen", { status: "vervallen" }),
        ],
        kostenRegels: [
          kostenRegel("a", "concept", 100, { categorieId: "keuken" }),
          kostenRegel("b", "controle", 200, { categorieId: "keuken" }),
          kostenRegel("c", "vervallen", 400, { categorieId: "keuken" }),
        ],
      }),
    );
    expect(cat(r, "keuken").gefactureerd).toBe(0);
    expect(cat(r, "keuken").prognose).toBe(0);
    expect(cat(r, "keuken").inControle).toBe(euro(300));
    expect(r.categorieen[0].documentenInControle).toBe(2);
  });

  it("betaalstatus: open, deels, betaald en te laat (vervaldatum voorbij)", () => {
    const r = reken(
      project({
        categorieen: [categorie("x")],
        documenten: [
          document("open", { vervalDatum: "2026-12-01" }),
          document("deels", { vervalDatum: "2026-12-10" }),
          document("klaar", { vervalDatum: "2026-11-01" }),
          document("laat", { vervalDatum: "2026-11-20" }),
        ],
        kostenRegels: ["open", "deels", "klaar", "laat"].map((d) =>
          kostenRegel(`${d}-r`, d, 100, { categorieId: "x" }),
        ),
        betalingen: [betaling("p1", "deels", 40), betaling("p2", "klaar", 100)],
      }),
    );
    const status = Object.fromEntries(
      r.documenten.map((d) => [d.id, d.betaalStatus]),
    );
    expect(status).toEqual({
      open: "open",
      deels: "deels",
      klaar: "betaald",
      laat: "te_laat",
    });
    expect(r.documenten.find((d) => d.id === "open")?.dagenTotVervallen).toBe(
      5,
    );
    expect(r.documenten.find((d) => d.id === "laat")?.dagenTotVervallen).toBe(
      -6,
    );
  });

  it("betalingen per maand", () => {
    const p = ikea();
    p.betalingen = [
      betaling("a", "ikea", 500, { datum: "2026-10-31" }),
      betaling("b", "ikea", 1_000, { datum: "2026-11-01" }),
      betaling("c", "ikea", 287.95, { datum: "2026-11-30" }),
    ];
    expect(reken(p).betalingenPerMaand).toEqual([
      { maand: "2026-10", bedrag: euro(500) },
      { maand: "2026-11", bedrag: euro(1_287.95) },
    ]);
  });
});

// -----------------------------------------------------------------------------
// Termijnschema
// -----------------------------------------------------------------------------
describe("termijnschema", () => {
  it("verwachte termijnbedragen tellen exact op tot het contract", () => {
    const r = reken(
      project({
        categorieen: [categorie("woning")],
        contracten: [contract("c")],
        contractRegels: [contractRegel("l", "c", "woning", 368_000.01)],
        termijnen: [
          termijn("t1", "c", 1, 33.33),
          termijn("t2", "c", 2, 33.33),
          termijn("t3", "c", 3, 33.34),
        ],
        documenten: [
          document("f1", {
            type: "termijnfactuur",
            contractId: "c",
            termijnId: "t1",
          }),
        ],
        kostenRegels: [
          kostenRegel("f1-r", "f1", 122_654.4, { contractId: "c" }),
        ],
      }),
    );
    const t = r.contracten[0].termijnen;
    expect(t.reduce((a, x) => a + x.verwachtBedrag, 0)).toBe(euro(368_000.01));
    expect(t.map((x) => x.status)).toEqual(["gefactureerd", "open", "open"]);
  });
});

// -----------------------------------------------------------------------------
// § 3.5 — Financiering
// -----------------------------------------------------------------------------
describe("financiering (§ 3.5)", () => {
  const basis = () =>
    project({
      categorieen: [categorie("woning")],
      budgetRegels: [budget("woning", 480_000)],
      documenten: [document("t1")],
      kostenRegels: [kostenRegel("r", "t1", 36_800, { categorieId: "woning" })],
      betalingen: [betaling("p", "t1", 36_800, { bronId: "depot" })],
      bronnen: [
        bron("hyp", "hypotheek", 400_000),
        bron("depot", "bouwdepot", 100_000, "hyp"),
        bron("rest", "overige_hypotheekruimte", 300_000, "hyp"),
        bron("eigen", "eigen_geld", 95_000),
      ],
    });

  it("hypotheek € 400.000 met bouwdepot € 100.000: totaal blijft € 400.000 (+ eigen geld)", () => {
    const f = reken(basis()).financiering;
    expect(f.totaalBeschikbaar).toBe(euro(495_000));
    const hyp = f.bronnen.find((b) => b.id === "hyp");
    expect(hyp?.delen.map((d) => d.id)).toEqual(["depot", "rest"]);
    expect(hyp?.betaald).toBe(euro(36_800));
    expect(hyp?.saldo).toBe(euro(363_200));
    expect(hyp?.delen[0]).toMatchObject({
      betaald: euro(36_800),
      saldo: euro(63_200),
    });
  });

  it("financiële ruimte = totaal beschikbaar − totale prognose", () => {
    const f = reken(basis()).financiering;
    expect(f.ruimte).toBe(euro(15_000));
    expect(f.beschikbaarNaBetalingen).toBe(euro(458_200));
    expect(f.nogTeBetalen).toBe(euro(443_200));
  });

  it("melding als de delen niet optellen tot de hypotheek", () => {
    const p = basis();
    p.bronnen[1].bedrag = euro(90_000);
    expect(reken(p).meldingen.map((m) => m.code)).toContain("delen_wijken_af");
  });
});

// -----------------------------------------------------------------------------
// § 3.6 — Ruimtes
// -----------------------------------------------------------------------------
describe("ruimtes (§ 3.6)", () => {
  it("verdeling per ruimte, erfenis van de contractregel en 'niet toegewezen'", () => {
    const r = reken(
      project({
        categorieen: [categorie("keuken"), categorie("inrichting")],
        ruimtes: [
          { id: "kk", naam: "Keuken", volgorde: 1 },
          { id: "wk", naam: "Woonkamer", volgorde: 2 },
        ],
        contracten: [contract("c")],
        contractRegels: [contractRegel("kl", "c", "keuken", 20_000)],
        documenten: [document("f"), document("bon", { type: "bon" })],
        kostenRegels: [
          kostenRegel("f1", "f", 6_000, { contractId: "c" }),
          kostenRegel("b1", "bon", 1_000, { categorieId: "inrichting" }),
          kostenRegel("b2", "bon", 300, { categorieId: "inrichting" }),
        ],
        ruimteVerdelingen: [
          {
            ruimteId: "kk",
            contractRegelId: "kl",
            kostenRegelId: null,
            aandeelBp: 10_000,
          },
          {
            ruimteId: "wk",
            kostenRegelId: "b1",
            contractRegelId: null,
            aandeelBp: 5_000,
          },
          {
            ruimteId: "kk",
            kostenRegelId: "b1",
            contractRegelId: null,
            aandeelBp: 5_000,
          },
        ],
      }),
    );
    const per = Object.fromEntries(r.ruimtes.map((x) => [x.naam, x]));
    expect(per.Keuken).toMatchObject({
      gecontracteerd: euro(20_000),
      gefactureerd: euro(6_500),
      vastgelegd: euro(20_500),
    });
    expect(per.Woonkamer.gefactureerd).toBe(euro(500));
    expect(per["Niet toegewezen"].gefactureerd).toBe(euro(300));
  });
});

// -----------------------------------------------------------------------------
// Vangnetten en invarianten
// -----------------------------------------------------------------------------
describe("vangnetten", () => {
  it("kostenregel zonder categorie en contract komt in 'onverdeeld' met een melding", () => {
    const r = reken(
      project({
        documenten: [document("f")],
        kostenRegels: [kostenRegel("f1", "f", 100, {})],
      }),
    );
    expect(r.onverdeeld.gefactureerd).toBe(euro(100));
    expect(r.cijfers.prognose).toBe(euro(100));
    expect(r.meldingen.map((m) => m.code)).toContain(
      "kostenregel_zonder_categorie",
    );
  });

  it("kosten op een contract zonder regels: los met melding", () => {
    const r = reken(
      project({
        categorieen: [categorie("x")],
        contracten: [contract("c")],
        documenten: [document("f")],
        kostenRegels: [
          kostenRegel("f1", "f", 100, { contractId: "c", categorieId: "x" }),
        ],
      }),
    );
    expect(cat(r, "x").vastgelegd).toBe(euro(100));
    expect(r.meldingen.map((m) => m.code)).toContain("contract_zonder_regels");
  });
});
