import { describe, expect, it } from "vitest";
import type { Herkenning } from "./schema";
import {
  foutMetDetail,
  isVastgelopen,
  letOpPerVeld,
  splitsFout,
  voorstelNaarInvoer,
  zuiverIds,
  type Geldig,
} from "./voorstel";

const v = <T>(waarde: T | null) => ({ waarde, zekerheid: 0.95, bron: null });

const regel = (aanpassing: Partial<Herkenning["regels"][number]> = {}) => ({
  omschrijving: " Termijn 1 ",
  bedrag_incl: 8100,
  bedrag_excl: null,
  btw_tarief: 21,
  categorie_id: null,
  ruimte_id: null,
  contract_regel_id: null,
  zekerheid: 0.9,
  bron: null,
  ...aanpassing,
});

function voorstel(aanpassing: Partial<Herkenning> = {}): Herkenning {
  return {
    is_document: true,
    soort: v("termijnfactuur"),
    leverancier: v("Keukenstudio Noord"),
    leverancier_kvk: v(null),
    leverancier_iban: v(null),
    leverancier_btw_nummer: v(null),
    documentnummer: v(" F-1 "),
    documentdatum: v("2026-11-10"),
    vervaldatum: v(null),
    betaaltermijn_dagen: v(14),
    totaal_incl: v(8100),
    totaal_btw: v(null),
    btw_per_tarief: [],
    verwijzing: v(null),
    contract_id: v("k1"),
    termijn_id: v("t1"),
    regels: [regel()],
    opmerkingen: [],
    ...aanpassing,
  };
}

const geldig: Geldig = {
  categorieen: new Set(["cat-keuken"]),
  ruimtes: new Set(["r-keuken"]),
  contracten: new Map([
    [
      "k1",
      {
        leverancierId: "lev-1",
        regels: new Set(["kr1"]),
        termijnen: new Set(["t1"]),
      },
    ],
    [
      "k2",
      {
        leverancierId: "lev-2",
        regels: new Set(["kr2"]),
        termijnen: new Set(["t2"]),
      },
    ],
  ]),
};

describe("AI-voorstel naar formulier", () => {
  it("contract en termijn blijven als ze bij de leverancier passen", () => {
    const h = zuiverIds(voorstel(), geldig, "lev-1");
    expect(h.contract_id.waarde).toBe("k1");
    expect(h.termijn_id.waarde).toBe("t1");
    const invoer = voorstelNaarInvoer(h, "lev-1");
    expect(invoer).toMatchObject({
      type: "termijnfactuur",
      leverancierId: "lev-1",
      nieuweLeverancier: null,
      contractId: "k1",
      termijnId: "t1",
      nummer: "F-1",
      datum: "2026-11-10",
      vervalDatum: "2026-11-24",
      totaalOpDocument: 810000,
    });
    // Regel zonder categorie bij een contract: naar rato over het contract.
    expect(invoer.regels).toEqual([
      {
        omschrijving: "Termijn 1",
        doel: "c:k1",
        bedrag: 810000,
        btw: 2100,
        ruimtes: [],
      },
    ]);
  });

  it("contract van een andere leverancier en onbekende id's vallen weg", () => {
    const h = zuiverIds(
      voorstel({
        contract_id: v("k2"),
        termijn_id: v("t2"),
        regels: [
          regel({
            categorie_id: "verzonnen",
            ruimte_id: "r-keuken",
            contract_regel_id: "kr2",
          }),
        ],
      }),
      geldig,
      "lev-1",
    );
    expect(h.contract_id.waarde).toBeNull();
    expect(h.termijn_id.waarde).toBeNull();
    expect(h.regels[0]).toMatchObject({
      categorie_id: null,
      ruimte_id: "r-keuken",
      contract_regel_id: null,
    });
    expect(voorstelNaarInvoer(h, "lev-1").regels[0].doel).toBe("");
  });

  it("een genoemde contractregel bepaalt het contract", () => {
    const h = zuiverIds(
      voorstel({
        contract_id: v(null),
        termijn_id: v(null),
        regels: [regel({ contract_regel_id: "kr1" })],
      }),
      geldig,
      null,
    );
    expect(h.contract_id.waarde).toBe("k1");
    expect(voorstelNaarInvoer(h, null).regels[0].doel).toBe("r:kr1");
  });

  it("zonder bekende leverancier: naam als nieuwe leverancier; bon zonder vervaldatum", () => {
    const invoer = voorstelNaarInvoer(
      voorstel({ soort: v("bon"), leverancier: v(" Bouwmarkt Zuid ") }),
      null,
    );
    expect(invoer.nieuweLeverancier).toBe("Bouwmarkt Zuid");
    expect(invoer.vervalDatum).toBeNull();
  });

  it("categorie gaat voor het contract; ongeldig tarief wordt 21%", () => {
    const invoer = voorstelNaarInvoer(
      zuiverIds(
        voorstel({
          regels: [regel({ categorie_id: "cat-keuken", btw_tarief: null })],
        }),
        geldig,
        "lev-1",
      ),
      "lev-1",
    );
    expect(invoer.regels[0]).toMatchObject({ doel: "k:cat-keuken", btw: 2100 });
  });
});

describe("letOpPerVeld", () => {
  it("zet punten bij het juiste formulierveld; duplicaten alleen bovenaan", () => {
    const uit = letOpPerVeld([
      { soort: "onzeker", veld: "documentdatum", tekst: "Datum onzeker" },
      { soort: "ontbreekt", veld: "regel-2", tekst: "Regel 2 mist doel" },
      { soort: "klopt-niet", veld: "regels", tekst: "Som klopt niet" },
      { soort: "klopt-niet", veld: "totaal_btw", tekst: "BTW wijkt af" },
      { soort: "onzeker", veld: "contract_id", tekst: "Contract onzeker" },
      {
        soort: "duplicaat",
        veld: "documentnummer",
        tekst: "Al ingevoerd",
        href: "/documenten/x",
      },
      { soort: "klopt-niet", veld: "document", tekst: "Geen factuur" },
    ]);
    expect(uit).toEqual({
      datum: ["Datum onzeker"],
      regels: ["Regel 2 mist doel", "Som klopt niet"],
      totaal: ["BTW wijkt af"],
      contract: ["Contract onzeker"],
    });
  });
});

describe("isVastgelopen", () => {
  const nu = Date.parse("2026-11-26T12:00:00Z");
  it("alleen bezig/wachtrij die langer dan 2 minuten niet zijn bijgewerkt", () => {
    expect(isVastgelopen("bezig", "2026-11-26T11:57:00Z", nu)).toBe(true);
    expect(isVastgelopen("bezig", "2026-11-26T11:59:00Z", nu)).toBe(false);
    expect(isVastgelopen("wachtrij", "2026-11-26T11:50:00Z", nu)).toBe(true);
    expect(isVastgelopen("mislukt", "2026-11-26T11:00:00Z", nu)).toBe(false);
    expect(isVastgelopen("te_controleren", "2026-11-26T11:00:00Z", nu)).toBe(
      false,
    );
  });
});

describe("foutMetDetail / splitsFout", () => {
  it("bewaart de technische melding apart van de melding voor de gebruiker", () => {
    const opgeslagen = foutMetDetail(
      "Dit bestand kon de AI niet lezen.",
      "400 · invalid_request_error · iets klopt niet",
    );
    expect(splitsFout(opgeslagen)).toEqual({
      fout: "Dit bestand kon de AI niet lezen.",
      detail: "400 · invalid_request_error · iets klopt niet",
    });
    expect(splitsFout("Alleen een melding.")).toEqual({
      fout: "Alleen een melding.",
      detail: null,
    });
    expect(splitsFout(null)).toEqual({ fout: null, detail: null });
    expect(foutMetDetail("x".repeat(1990), "y".repeat(100))).toHaveLength(2000);
  });
});
