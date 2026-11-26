import { describe, expect, it } from "vitest";
import { berekenProject } from "./bereken";
import {
  budget,
  categorie,
  contract,
  contractRegel,
  euro,
  project,
  VANDAAG,
} from "./testdata";
import { metExtraContract } from "./wat-als";

const prognose = (p: ReturnType<typeof project>, id: string) =>
  berekenProject(p, VANDAAG).categorieen.find((c) => c.id === id)?.cijfers
    .prognose;

describe("wat als: offerte accepteren", () => {
  const basis = project({
    categorieen: [
      categorie("afbouw"),
      categorie("keuken", { parentId: "afbouw" }),
      categorie("sanitair", { parentId: "afbouw" }),
    ],
    budgetRegels: [budget("keuken", 25_000), budget("sanitair", 12_000)],
  });

  it("een offerte boven budget verhoogt de prognose tot het offertebedrag", () => {
    const na = metExtraContract(basis, [
      { categorieId: "keuken", omschrijving: "Keuken", bedrag: euro(26_350) },
    ]);
    expect(prognose(basis, "keuken")).toBe(euro(25_000));
    expect(prognose(na, "keuken")).toBe(euro(26_350));
    expect(prognose(na, "afbouw")).toBe(euro(38_350));
  });

  it("een offerte onder budget laat de prognose op het budget zolang de categorie open is", () => {
    const na = metExtraContract(basis, [
      { categorieId: "keuken", omschrijving: "Keuken", bedrag: euro(21_000) },
    ]);
    expect(prognose(na, "keuken")).toBe(euro(25_000));
    const keuken = berekenProject(na, VANDAAG).categorieen.find(
      (c) => c.id === "keuken",
    )!.cijfers;
    expect(keuken.vastgelegd).toBe(euro(21_000));
    expect(keuken.nogNietVastgelegd).toBe(euro(4_000));
  });

  it("telt bij een bestaand contract op en negeert regels zonder categorie", () => {
    const metContract = project({
      ...basis,
      contracten: [contract("tegelzetter")],
      contractRegels: [contractRegel("t1", "tegelzetter", "sanitair", 8_000)],
    });
    const na = metExtraContract(metContract, [
      { categorieId: "sanitair", omschrijving: "Kranen", bedrag: euro(5_500) },
      { categorieId: null, omschrijving: "Onbekend", bedrag: euro(999) },
    ]);
    expect(prognose(na, "sanitair")).toBe(euro(13_500));
    expect(berekenProject(na, VANDAAG).cijfers.prognose).toBe(euro(38_500));
    // De invoer zelf blijft ongewijzigd.
    expect(metContract.contractRegels).toHaveLength(1);
  });
});
