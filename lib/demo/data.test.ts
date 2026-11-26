import { describe, expect, it } from "vitest";
import { demoDashboard } from "./dashboard";

const euro = (n: number) => Math.round(n * 100);

/**
 * Het demo-project gaat door dezelfde rekenlogica als de echte gegevens.
 * Deze test legt vast dat de uitkomst gelijk is aan het ontwerp uit fase 1.
 */
describe("demo-project via de rekenlogica", () => {
  const { resultaat: r, openPosten, maanden } = demoDashboard();

  it("projecttotalen", () => {
    expect(r.cijfers).toMatchObject({
      budget: euro(485_000),
      gecontracteerd: euro(435_650),
      gefactureerd: euro(286_012),
      betaald: euro(245_712),
      openstaand: euro(40_300),
      prognose: euro(489_580),
      afwijking: euro(4_580),
      inControle: euro(8_735.25),
    });
    expect(r.financiering.totaalBeschikbaar).toBe(euro(495_000));
    expect(r.financiering.ruimte).toBe(euro(5_420));
    expect(r.meldingen).toEqual([]);
  });

  it("categorieën: overschrijdingen en de meevaller van de afgesloten categorie", () => {
    const per = Object.fromEntries(r.categorieen.map((c) => [c.id, c.cijfers]));
    expect(per.meerwerk.afwijking).toBe(euro(3_450));
    expect(per.keuken.afwijking).toBe(euro(2_350));
    expect(per.notaris.afwijking).toBe(euro(-1_220));
    expect(per.badkamer.prognose).toBe(euro(15_500));
    expect(per.aanneemsom).toMatchObject({
      gefactureerd: euro(257_600),
      betaald: euro(220_800),
    });
  });

  it("bouwdepot, betalingen per maand en openstaande posten", () => {
    const depot = r.financiering.bronnen
      .flatMap((b) => b.delen)
      .find((d) => d.type === "bouwdepot");
    expect(depot).toMatchObject({
      betaald: euro(92_000),
      saldo: euro(168_000),
    });
    expect(maanden.map((m) => m.betaald)).toEqual(
      [61_480, 36_800, 18_400, 21_587, 14_205, 36_800, 36_800, 19_640].map(
        euro,
      ),
    );
    expect(
      openPosten.map((p) => [
        p.omschrijving,
        p.openstaand,
        p.dagenTotVervallen,
      ]),
    ).toEqual([
      ["Termijn 8 · dakconstructie gereed", euro(36_800), 5],
      ["Meerwerk MW-014 · extra wandcontactdozen", euro(3_500), 14],
    ]);
  });

  it("termijnschema van de aanneemsom", () => {
    const aanneem = r.contracten.find((c) => c.id === "aanneem");
    expect(aanneem?.termijnen.map((t) => t.status)).toEqual([
      ...Array(8).fill("gefactureerd"),
      "open",
      "open",
    ]);
  });
});
