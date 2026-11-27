import { describe, expect, it } from "vitest";
import { vanafExclusief, vanafInclusief } from "./btw";

describe("vanafInclusief", () => {
  it("splitst € 24.000 incl. 21% BTW", () => {
    expect(vanafInclusief(2_400_000, 2100)).toEqual({
      excl: 1_983_471,
      btw: 416_529,
      incl: 2_400_000,
    });
  });

  it("9% en 0%", () => {
    expect(vanafInclusief(10_900, 900)).toEqual({
      excl: 10_000,
      btw: 900,
      incl: 10_900,
    });
    expect(vanafInclusief(12_345, 0)).toEqual({
      excl: 12_345,
      btw: 0,
      incl: 12_345,
    });
  });

  it("excl + btw is altijd exact incl, ook bij negatieve bedragen", () => {
    for (const incl of [1, 2, 3, 99, 121, 12_100, 1_787_95, -30_000, -1]) {
      for (const tarief of [2100, 900, 0] as const) {
        const r = vanafInclusief(incl, tarief);
        expect(r.excl + r.btw).toBe(incl);
      }
    }
  });

  it("weigert halve centen en onbekende tarieven", () => {
    expect(() => vanafInclusief(10.5, 2100)).toThrow(TypeError);
    // @ts-expect-error onbekend tarief
    expect(() => vanafInclusief(100, 1900)).toThrow(RangeError);
  });
});

describe("vanafExclusief", () => {
  it("berekent BTW op hele centen", () => {
    expect(vanafExclusief(1_983_471, 2100)).toEqual({
      excl: 1_983_471,
      btw: 416_529,
      incl: 2_400_000,
    });
    expect(vanafExclusief(-10_000, 2100)).toEqual({
      excl: -10_000,
      btw: -2_100,
      incl: -12_100,
    });
  });
});
