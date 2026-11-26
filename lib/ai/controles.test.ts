import { describe, expect, it } from "vitest";
import { controleer, naarCenten, tariefBp, zoekLeverancier } from "./controles";
import type { Herkenning } from "./schema";

const v = <T>(waarde: T | null, zekerheid = 0.97) => ({
  waarde,
  zekerheid,
  bron: null,
});

/** Een kloppende factuur: 2 regels, 21% BTW, totaal € 1.815. */
function factuur(aanpassing: Partial<Herkenning> = {}): Herkenning {
  return {
    is_document: true,
    soort: v("factuur"),
    leverancier: v("Keukenstudio Noord B.V."),
    leverancier_kvk: v("12345678"),
    leverancier_iban: v(null),
    leverancier_btw_nummer: v(null),
    documentnummer: v("F-2026-118"),
    documentdatum: v("2026-11-20"),
    vervaldatum: v("2026-12-04"),
    betaaltermijn_dagen: v(14),
    totaal_incl: v(1815),
    totaal_btw: v(315),
    btw_per_tarief: [{ tarief: 21, grondslag: 1500, btw: 315 }],
    verwijzing: v(null),
    contract_id: v(null),
    termijn_id: v(null),
    regels: [
      {
        omschrijving: "Werkblad",
        bedrag_incl: 1210,
        bedrag_excl: 1000,
        btw_tarief: 21,
        categorie_id: "cat-keuken",
        ruimte_id: null,
        contract_regel_id: null,
        zekerheid: 0.95,
        bron: null,
      },
      {
        omschrijving: "Montage",
        bedrag_incl: 605,
        bedrag_excl: 500,
        btw_tarief: 21,
        categorie_id: "cat-keuken",
        ruimte_id: null,
        contract_regel_id: null,
        zekerheid: 0.95,
        bron: null,
      },
    ],
    opmerkingen: [],
    ...aanpassing,
  };
}

const ctx = {
  leverancierId: "lev-1",
  bestaande: [],
  vandaag: "2026-11-26",
};
const soorten = (punten: { soort: string }[]) => punten.map((p) => p.soort);

describe("controles op een AI-voorstel", () => {
  it("een kloppende factuur geeft geen aandachtspunten", () => {
    expect(controleer(factuur(), ctx)).toEqual([]);
  });

  it("som van de regels ≠ totaal: klopt niet", () => {
    const p = controleer(factuur({ totaal_incl: v(1820) }), ctx);
    expect(p).toContainEqual(
      expect.objectContaining({ soort: "klopt-niet", veld: "totaal_incl" }),
    );
  });

  it("excl. + BTW ≠ incl. op een regel: klopt niet (1 cent marge)", () => {
    const h = factuur();
    h.regels[0].bedrag_incl = 1210.01; // binnen de marge
    h.totaal_incl = v(1815.01);
    expect(soorten(controleer(h, ctx))).not.toContain("klopt-niet");
    h.regels[0].bedrag_incl = 1212;
    h.totaal_incl = v(1817);
    expect(controleer(h, ctx)).toContainEqual(
      expect.objectContaining({ soort: "klopt-niet", veld: "regel-1" }),
    );
  });

  it("BTW per tarief moet passen bij de regels", () => {
    const p = controleer(
      factuur({ btw_per_tarief: [{ tarief: 21, grondslag: 1500, btw: 320 }] }),
      ctx,
    );
    expect(p).toContainEqual(
      expect.objectContaining({ soort: "klopt-niet", veld: "totaal_btw" }),
    );
  });

  it("factuur zonder nummer en vervaldatum: ontbreekt; bij een bon niet", () => {
    const zonder = {
      documentnummer: v<string>(null),
      vervaldatum: v<string>(null),
      betaaltermijn_dagen: v<number>(null),
    };
    expect(
      controleer(factuur(zonder), ctx).filter((p) => p.soort === "ontbreekt"),
    ).toHaveLength(2);
    expect(
      soorten(controleer(factuur({ ...zonder, soort: v("bon") }), ctx)),
    ).not.toContain("ontbreekt");
  });

  it("lage zekerheid is alleen een waarschuwing; hoge zekerheid redt geen rekenfout", () => {
    const p = controleer(factuur({ documentdatum: v("2026-11-20", 0.6) }), ctx);
    expect(p).toEqual([
      expect.objectContaining({ soort: "onzeker", veld: "documentdatum" }),
    ]);
    const fout = controleer(factuur({ totaal_incl: v(9999, 0.99) }), ctx);
    expect(soorten(fout)).toContain("klopt-niet");
  });

  it("regel zonder categorie of contractregel: ontbreekt", () => {
    const h = factuur();
    h.regels[1].categorie_id = null;
    expect(controleer(h, ctx)).toContainEqual(
      expect.objectContaining({ soort: "ontbreekt", veld: "regel-2" }),
    );
  });

  it("onbekend BTW-tarief en fractie als tarief", () => {
    expect(tariefBp(21)).toBe(2100);
    expect(tariefBp(0.09)).toBe(900);
    expect(tariefBp(19)).toBeNull();
    const h = factuur();
    h.regels[0].btw_tarief = 19;
    expect(controleer(h, ctx)).toContainEqual(
      expect.objectContaining({ soort: "klopt-niet", veld: "regel-1" }),
    );
  });

  it("datum in de toekomst en vervaldatum vóór de datum", () => {
    const p = controleer(
      factuur({ documentdatum: v("2026-12-10"), vervaldatum: v("2026-12-01") }),
      ctx,
    );
    expect(p).toContainEqual(
      expect.objectContaining({ soort: "onzeker", veld: "documentdatum" }),
    );
    expect(p).toContainEqual(
      expect.objectContaining({ soort: "klopt-niet", veld: "vervaldatum" }),
    );
  });

  it("duplicaat op leverancier + nummer en op bedrag binnen 7 dagen", () => {
    const bestaande = [
      {
        id: "d1",
        leverancierId: "lev-1",
        nummer: "f-2026-118",
        datum: "2026-10-01",
        totaal: 5000,
        status: "geboekt",
      },
      {
        id: "d2",
        leverancierId: "lev-1",
        nummer: "F-77",
        datum: "2026-11-24",
        totaal: 181500,
        status: "geboekt",
      },
      {
        id: "d3",
        leverancierId: "lev-1",
        nummer: "F-78",
        datum: "2026-11-01",
        totaal: 181500,
        status: "geboekt",
      },
      {
        id: "d4",
        leverancierId: "lev-2",
        nummer: "F-2026-118",
        datum: "2026-11-20",
        totaal: 181500,
        status: "geboekt",
      },
      {
        id: "d5",
        leverancierId: "lev-1",
        nummer: "F-79",
        datum: "2026-11-21",
        totaal: 181500,
        status: "vervallen",
      },
    ];
    const dubbel = controleer(factuur(), { ...ctx, bestaande }).filter(
      (p) => p.soort === "duplicaat",
    );
    expect(dubbel.map((p) => p.href)).toEqual([
      "/documenten/d1",
      "/documenten/d2",
    ]);
  });

  it("geen document: één duidelijk aandachtspunt", () => {
    expect(controleer(factuur({ is_document: false }), ctx)).toEqual([
      expect.objectContaining({ soort: "ontbreekt", veld: "document" }),
    ]);
  });

  it("naarCenten rondt af op hele centen", () => {
    expect(naarCenten(1234.56)).toBe(123456);
    expect(naarCenten(0.1 + 0.2)).toBe(30);
    expect(naarCenten(null)).toBeNull();
  });
});

describe("leverancier zoeken", () => {
  const leveranciers = [
    {
      id: "a",
      naam: "Keukenstudio Noord",
      kvk: "12345678",
      iban: null,
      btwNummer: null,
    },
    {
      id: "b",
      naam: "Bouwmarkt Zuid B.V.",
      kvk: null,
      iban: "NL91ABNA0417164300",
      btwNummer: null,
    },
    {
      id: "c",
      naam: "Installatiebedrijf Oost",
      kvk: null,
      iban: null,
      btwNummer: "NL001234567B01",
    },
  ];
  const met = (aanpassing: Partial<Herkenning>) =>
    factuur({
      leverancier: v(null),
      leverancier_kvk: v(null),
      ...aanpassing,
    });

  it("op KvK, IBAN, BTW-nummer of naam", () => {
    expect(
      zoekLeverancier(met({ leverancier_kvk: v("1234 5678") }), leveranciers),
    ).toBe("a");
    expect(
      zoekLeverancier(
        met({ leverancier_iban: v("nl91 abna 0417 1643 00") }),
        leveranciers,
      ),
    ).toBe("b");
    expect(
      zoekLeverancier(
        met({ leverancier_btw_nummer: v("NL001234567B01") }),
        leveranciers,
      ),
    ).toBe("c");
    expect(
      zoekLeverancier(met({ leverancier: v("BOUWMARKT ZUID") }), leveranciers),
    ).toBe("b");
    expect(
      zoekLeverancier(
        met({ leverancier: v("Keukenstudio Noord B.V.") }),
        leveranciers,
      ),
    ).toBe("a");
    expect(
      zoekLeverancier(met({ leverancier: v("Tegelhuis") }), leveranciers),
    ).toBeNull();
  });
});
