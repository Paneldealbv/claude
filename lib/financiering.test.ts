import { describe, expect, it } from "vitest";
import {
  dagenTot,
  declarabel,
  depotStand,
  hypotheekDelen,
} from "./financiering";

describe("hypotheekDelen", () => {
  it("verdeelt de hypotheek in bouwdepot en overige ruimte", () => {
    expect(hypotheekDelen(40000000, 10000000)).toEqual({
      depot: 10000000,
      overig: 30000000,
    });
    expect(hypotheekDelen(40000000, 40000000)).toEqual({
      depot: 40000000,
      overig: 0,
    });
  });
  it("zonder bouwdepot geen delen; te groot of negatief is een fout", () => {
    expect(hypotheekDelen(40000000, null)).toBeNull();
    expect(hypotheekDelen(40000000, 0)).toBeNull();
    expect(hypotheekDelen(40000000, 40000001)).toEqual({
      fout: "Het bouwdepot is hoger dan het hypotheekbedrag.",
    });
    expect(hypotheekDelen(40000000, -1)).toEqual({
      fout: "Het bouwdepot kan niet negatief zijn.",
    });
  });
});

describe("depotStand", () => {
  it("telt uitbetaald, ingediend en concept; afgewezen telt niet", () => {
    expect(
      depotStand({ bedrag: 10000000, betaald: 1300000 }, [
        { status: "uitbetaald", bedrag: 1300000 },
        { status: "ingediend", bedrag: 500000 },
        { status: "concept", bedrag: 200000 },
        { status: "afgewezen", bedrag: 900000 },
      ]),
    ).toEqual({
      uitbetaald: 1300000,
      ingediend: 500000,
      concept: 200000,
      vrij: 8000000,
    });
  });
});

describe("declarabel / dagenTot", () => {
  it("nooit meer declareren dan de factuur, nooit negatief", () => {
    expect(declarabel(300000, 100000)).toBe(200000);
    expect(declarabel(300000, 400000)).toBe(0);
  });
  it("dagen tot een datum, zonder tijdzonegedoe", () => {
    expect(dagenTot("2026-12-01", "2026-11-27")).toBe(4);
    expect(dagenTot("2026-11-20", "2026-11-27")).toBe(-7);
    expect(dagenTot(null, "2026-11-27")).toBeNull();
  });
});
