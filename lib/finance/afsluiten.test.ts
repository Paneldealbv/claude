import { describe, expect, it } from "vitest";
import { controleerAfsluiten } from "./afsluiten";
import {
  betaling,
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

describe("controle vóór het afsluiten van een categorie", () => {
  it("niets meer open: direct afsluiten, meevaller wordt zichtbaar", () => {
    const p = project({
      categorieen: [categorie("notaris")],
      budgetRegels: [budget("notaris", 7_500)],
      documenten: [document("f")],
      kostenRegels: [kostenRegel("f1", "f", 6_280, { categorieId: "notaris" })],
      betalingen: [betaling("p", "f", 6_280)],
    });
    const c = controleerAfsluiten(p, "notaris", VANDAAG);
    expect(c.kanDirectAfsluiten).toBe(true);
    expect(c.waarschuwingen).toEqual([]);
    expect(c.prognoseNu).toBe(euro(7_500));
    expect(c.prognoseNaAfsluiten).toBe(euro(6_280));
    expect(c.afwijkingNaAfsluiten).toBe(euro(-1_220));
  });

  it("waarschuwt voor openstaande facturen, verplichtingen, termijnen, meerwerk en controles", () => {
    const p = project({
      categorieen: [
        categorie("afbouw"),
        categorie("keuken", { parentId: "afbouw" }),
      ],
      budgetRegels: [budget("keuken", 24_000)],
      contracten: [contract("k")],
      contractRegels: [contractRegel("kl", "k", "keuken", 26_350)],
      wijzigingen: [wijziging("extra", "kl", 450, "voorgesteld")],
      termijnen: [termijn("t1", "k", 1, 30), termijn("t2", "k", 2, 70)],
      documenten: [
        document("aanbetaling", {
          type: "termijnfactuur",
          contractId: "k",
          termijnId: "t1",
        }),
        document("bon", { status: "te_controleren" }),
      ],
      kostenRegels: [
        kostenRegel("a1", "aanbetaling", 7_905, { contractId: "k" }),
        kostenRegel("b1", "bon", 120, { categorieId: "keuken" }),
      ],
      betalingen: [betaling("p", "aanbetaling", 5_000)],
    });

    // Afsluiten van de hoofdcategorie kijkt ook naar de subcategorieën.
    const c = controleerAfsluiten(p, "afbouw", VANDAAG);
    expect(c.kanDirectAfsluiten).toBe(false);
    const perCode = Object.fromEntries(
      c.waarschuwingen.map((w) => [w.code, w]),
    );
    expect(perCode.openstaande_facturen).toMatchObject({
      aantal: 1,
      bedrag: euro(2_905),
    });
    expect(perCode.openstaande_verplichtingen).toMatchObject({
      aantal: 1,
      bedrag: euro(18_445),
    });
    expect(perCode.open_termijnen).toMatchObject({
      aantal: 1,
      bedrag: euro(18_445),
    });
    expect(perCode.voorgesteld_meerwerk).toMatchObject({
      aantal: 1,
      bedrag: euro(450),
    });
    expect(perCode.te_controleren).toMatchObject({
      aantal: 1,
      bedrag: euro(120),
    });
    expect(perCode.openstaande_facturen.tekst).toBe(
      "1 factuur is nog niet volledig betaald (€ 2.905).",
    );
  });

  it("onbekende categorie geeft een fout", () => {
    expect(() =>
      controleerAfsluiten(project(), "bestaat-niet", VANDAAG),
    ).toThrow(RangeError);
  });
});
