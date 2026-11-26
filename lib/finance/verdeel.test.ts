import { describe, expect, it } from "vitest";
import { verdeel } from "./verdeel";

const som = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("verdeel", () => {
  it("verdeelt naar rato met de grootste-restmethode", () => {
    expect(verdeel(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(verdeel(1000, [7000, 3000])).toEqual([700, 300]);
    expect(verdeel(10, [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    expect(verdeel(1, [1, 1])).toEqual([1, 0]);
  });

  it("geeft de extra cent aan de grootste rest, bij gelijkspel aan de eerste", () => {
    // 100 × 1/6 = 16,67 · 100 × 2/6 = 33,33 · 100 × 3/6 = 50
    expect(verdeel(100, [1, 2, 3])).toEqual([17, 33, 50]);
    expect(verdeel(2, [1, 1, 1])).toEqual([1, 1, 0]);
  });

  it("werkt met negatieve totalen (creditnota)", () => {
    expect(verdeel(-100, [1, 1, 1])).toEqual([-33, -33, -34]);
    expect(som(verdeel(-100, [1, 1, 1]))).toBe(-100);
  });

  it("werkt met gewichten van gemengd teken (bon met retourregel)", () => {
    // Regels +100 en −20 (samen 80) volledig betaald: exact per regel.
    expect(verdeel(80, [100, -20])).toEqual([100, -20]);
    // Half betaald.
    expect(verdeel(40, [100, -20])).toEqual([50, -10]);
  });

  it("valt terug op absolute of gelijke gewichten als die samen 0 zijn", () => {
    expect(verdeel(10, [20, -20])).toEqual([5, 5]);
    expect(verdeel(10, [0, 0, 0])).toEqual([4, 3, 3]);
  });

  it("blijft exact bij grote bedragen en gewichten", () => {
    const totaal = 9_000_000_000_00; // € 9 miljard in centen
    const delen = verdeel(totaal, [123_456_789_00, 987_654_321_00, 1]);
    expect(som(delen)).toBe(totaal);
  });

  it("telt altijd exact op tot het totaal (willekeurige gevallen)", () => {
    let zaad = 42;
    const willekeurig = (max: number) => {
      zaad = (zaad * 1103515245 + 12345) % 2147483648;
      return zaad % max;
    };
    for (let i = 0; i < 500; i++) {
      const n = 1 + willekeurig(8);
      const gewichten = Array.from(
        { length: n },
        () => willekeurig(1_000_000) - 200_000,
      );
      const totaal = willekeurig(10_000_000) - 2_000_000;
      const delen = verdeel(totaal, gewichten);
      expect(som(delen)).toBe(totaal);
      expect(delen.every(Number.isInteger)).toBe(true);
    }
  });

  it("weigert ongeldige invoer", () => {
    expect(() => verdeel(10.5, [1])).toThrow(TypeError);
    expect(() => verdeel(10, [0.5])).toThrow(TypeError);
    expect(() => verdeel(10, [])).toThrow(RangeError);
    expect(verdeel(0, [])).toEqual([]);
  });
});
