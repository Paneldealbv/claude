/**
 * Regels die voor ELK project moeten gelden, getoetst op honderden
 * willekeurig opgebouwde projecten (met vaste beginwaarde, dus herhaalbaar).
 */
import { describe, expect, it } from "vitest";
import { berekenProject } from "./bereken";
import { VANDAAG } from "./testdata";
import type { Cijfers, ProjectInvoer } from "./types";

function maakWillekeurig(zaad: number) {
  let s = zaad;
  const getal = (max: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % max;
  };
  const kies = <T>(lijst: T[]): T => lijst[getal(lijst.length)];
  return { getal, kies };
}

function willekeurigProject(zaad: number): ProjectInvoer {
  const { getal, kies } = maakWillekeurig(zaad);
  const p: ProjectInvoer = {
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
  };

  // Boom: 2 hoofdcategorieën met elk 1–3 bladeren.
  const bladeren: string[] = [];
  for (let h = 0; h < 2; h++) {
    p.categorieen.push({
      id: `h${h}`,
      parentId: null,
      naam: `H${h}`,
      volgorde: h,
      afgesloten: getal(5) === 0,
    });
    for (let b = 0; b < 1 + getal(3); b++) {
      const id = `h${h}b${b}`;
      bladeren.push(id);
      p.categorieen.push({
        id,
        parentId: `h${h}`,
        naam: id,
        volgorde: b,
        afgesloten: getal(4) === 0,
      });
      if (getal(3) > 0)
        p.budgetRegels.push({
          id: `bu-${id}`,
          categorieId: id,
          bedrag: getal(5_000_000),
        });
    }
  }
  for (let r = 0; r < 3; r++)
    p.ruimtes.push({ id: `r${r}`, naam: `R${r}`, volgorde: r });

  // Contracten met regels, wijzigingen en termijnen.
  for (let c = 0; c < 1 + getal(3); c++) {
    p.contracten.push({
      id: `c${c}`,
      titel: `C${c}`,
      leverancierId: null,
      status: kies(["actief", "actief", "afgerond", "geannuleerd"] as const),
    });
    for (let l = 0; l < 1 + getal(3); l++) {
      const id = `c${c}l${l}`;
      p.contractRegels.push({
        id,
        contractId: `c${c}`,
        categorieId: kies(bladeren),
        omschrijving: id,
        bedrag: getal(3_000_000),
      });
      if (getal(2))
        p.wijzigingen.push({
          id: `w-${id}`,
          contractRegelId: id,
          bedrag: getal(400_000) - 100_000,
          status: kies(["akkoord", "voorgesteld", "afgewezen"] as const),
        });
      if (getal(2))
        p.ruimteVerdelingen.push({
          ruimteId: kies(["r0", "r1", "r2"]),
          contractRegelId: id,
          kostenRegelId: null,
          aandeelBp: 10_000,
        });
    }
    p.termijnen.push({
      id: `t-c${c}`,
      contractId: `c${c}`,
      volgorde: 1,
      omschrijving: "T1",
      percentageBp: 3_333,
      bedrag: null,
      verwachteDatum: null,
    });
  }

  // Documenten met regels (los, op contract, op contractregel) en betalingen.
  for (let d = 0; d < 2 + getal(6); d++) {
    const id = `d${d}`;
    const contractId = getal(2) ? kies(p.contracten).id : null;
    p.documenten.push({
      id,
      type: kies(["factuur", "termijnfactuur", "bon", "creditnota"] as const),
      status: kies([
        "geboekt",
        "geboekt",
        "geboekt",
        "concept",
        "te_controleren",
        "vervallen",
      ] as const),
      leverancierId: null,
      contractId,
      termijnId: contractId && getal(2) ? `t-${contractId}` : null,
      documentDatum: "2026-11-01",
      vervalDatum: getal(2) ? "2026-11-20" : null,
    });
    let totaal = 0;
    for (let k = 0; k < 1 + getal(4); k++) {
      const bedrag = getal(800_000) - (getal(6) === 0 ? 900_000 : 0);
      totaal += bedrag;
      const soort = getal(3);
      const regels = p.contractRegels.filter(
        (r) => r.contractId === contractId,
      );
      const regelId = `${id}k${k}`;
      p.kostenRegels.push({
        id: regelId,
        documentId: id,
        bedrag,
        categorieId:
          soort === 0 || !contractId
            ? kies(bladeren)
            : getal(2)
              ? kies(bladeren)
              : null,
        contractId: soort > 0 ? contractId : null,
        contractRegelId: soort === 2 && regels.length ? kies(regels).id : null,
      });
      if (getal(3) === 0) {
        p.ruimteVerdelingen.push(
          {
            ruimteId: "r0",
            kostenRegelId: regelId,
            contractRegelId: null,
            aandeelBp: 2_500,
          },
          {
            ruimteId: "r1",
            kostenRegelId: regelId,
            contractRegelId: null,
            aandeelBp: 7_500,
          },
        );
      }
    }
    if (getal(2)) {
      const deel = Math.trunc((totaal * getal(101)) / 100);
      if (deel !== 0) {
        p.betalingen.push({
          id: `p-${id}`,
          documentId: id,
          bronId: getal(2) ? "depot" : "eigen",
          bedrag: deel,
          datum: `2026-${String(1 + getal(12)).padStart(2, "0")}-15`,
        });
      }
    }
  }

  p.bronnen.push(
    {
      id: "hyp",
      parentId: null,
      type: "hypotheek",
      naam: "Hypotheek",
      bedrag: 40_000_000,
    },
    {
      id: "depot",
      parentId: "hyp",
      type: "bouwdepot",
      naam: "Bouwdepot",
      bedrag: 10_000_000,
    },
    {
      id: "rest",
      parentId: "hyp",
      type: "overige_hypotheekruimte",
      naam: "Rest",
      bedrag: 30_000_000,
    },
    {
      id: "eigen",
      parentId: null,
      type: "eigen_geld",
      naam: "Eigen geld",
      bedrag: 9_500_000,
    },
  );
  return p;
}

const velden: (keyof Cijfers)[] = [
  "budget",
  "gecontracteerd",
  "gefactureerd",
  "betaald",
  "openstaand",
  "vastgelegd",
  "nogNietVastgelegd",
  "prognose",
  "afwijking",
];

describe("invarianten over willekeurige projecten", () => {
  const projecten = Array.from({ length: 300 }, (_, i) =>
    willekeurigProject(i + 1),
  );

  it("prognose = vastgelegd + nog niet vastgelegd, openstaand = gefactureerd − betaald", () => {
    for (const p of projecten) {
      const r = berekenProject(p, VANDAAG);
      for (const c of [r.cijfers, ...r.categorieen.map((x) => x.cijfers)]) {
        expect(c.prognose).toBe(c.vastgelegd + c.nogNietVastgelegd);
        expect(c.openstaand).toBe(c.gefactureerd - c.betaald);
        expect(c.afwijking).toBe(c.prognose - c.budget);
        expect(c.nogNietVastgelegd).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("project = som van de hoofdcategorieën + onverdeeld; hoofdcategorie = som van haar kinderen", () => {
    for (const p of projecten) {
      const r = berekenProject(p, VANDAAG);
      for (const v of velden) {
        const wortels = r.categorieen.filter((c) => c.parentId === null);
        expect(
          wortels.reduce((a, c) => a + c.cijfers[v], r.onverdeeld[v]),
        ).toBe(r.cijfers[v]);
        for (const h of wortels) {
          const kinderen = r.categorieen.filter((c) => c.parentId === h.id);
          expect(kinderen.reduce((a, c) => a + c.cijfers[v], 0)).toBe(
            h.cijfers[v],
          );
        }
      }
    }
  });

  it("gefactureerd en betaald sluiten aan op de geboekte documenten (geen dubbeltelling)", () => {
    for (const p of projecten) {
      const r = berekenProject(p, VANDAAG);
      const geboekt = new Set(
        p.documenten.filter((d) => d.status === "geboekt").map((d) => d.id),
      );
      const factuur = p.kostenRegels
        .filter((k) => geboekt.has(k.documentId))
        .reduce((a, k) => a + k.bedrag, 0);
      const betaald = p.betalingen
        .filter((b) => geboekt.has(b.documentId))
        .reduce((a, b) => a + b.bedrag, 0);
      expect(r.cijfers.gefactureerd).toBe(factuur);
      expect(r.cijfers.betaald).toBe(betaald);
      expect(r.betalingenPerMaand.reduce((a, m) => a + m.bedrag, 0)).toBe(
        betaald,
      );
    }
  });

  it("vastgelegd = som van de contractprognoses + losse geboekte kosten", () => {
    for (const p of projecten) {
      const r = berekenProject(p, VANDAAG);
      const contracten = r.contracten.reduce((a, c) => a + c.prognose, 0);
      const losGefactureerd =
        r.cijfers.gefactureerd -
        r.contracten.reduce((a, c) => a + c.gefactureerd, 0);
      expect(r.cijfers.vastgelegd).toBe(contracten + losGefactureerd);
    }
  });

  it("de ruimterapportage telt op tot dezelfde totalen (incl. 'niet toegewezen')", () => {
    for (const p of projecten) {
      const r = berekenProject(p, VANDAAG);
      for (const v of [
        "gecontracteerd",
        "gefactureerd",
        "betaald",
        "vastgelegd",
      ] as const) {
        expect(r.ruimtes.reduce((a, x) => a + x[v], 0)).toBe(r.cijfers[v]);
      }
    }
  });

  it("financiering: beschikbaar = hoofdbronnen; saldi sluiten aan op de betalingen", () => {
    for (const p of projecten) {
      const r = berekenProject(p, VANDAAG);
      const f = r.financiering;
      expect(f.totaalBeschikbaar).toBe(49_500_000);
      expect(
        f.bronnen.reduce((a, b) => a + b.betaald, 0) + f.betaaldZonderBron,
      ).toBe(r.cijfers.betaald);
      expect(f.ruimte).toBe(f.totaalBeschikbaar - r.cijfers.prognose);
    }
  });

  it("alle bedragen zijn hele centen en de uitkomst is altijd gelijk (deterministisch)", () => {
    for (const p of projecten.slice(0, 50)) {
      const a = berekenProject(p, VANDAAG);
      const b = berekenProject(structuredClone(p), VANDAAG);
      expect(b).toEqual(a);
      for (const v of velden) expect(Number.isInteger(a.cijfers[v])).toBe(true);
    }
  });
});
