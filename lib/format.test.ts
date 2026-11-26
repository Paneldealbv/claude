import { describe, expect, it } from "vitest";
import {
  formatDatum,
  formatEuro,
  formatEuroKort,
  formatEuroVerschil,
  parseEuro,
} from "./format";

// Intl gebruikt een vaste spatie (U+00A0) tussen € en het bedrag.
const nbsp = (s: string) => s.replace(/ /g, " ");

describe("formatEuro", () => {
  it("toont centen als euro in Nederlandse notatie", () => {
    expect(formatEuro(123456)).toBe(nbsp("€ 1.234,56"));
    expect(formatEuro(0)).toBe(nbsp("€ 0,00"));
    expect(formatEuro(1500000)).toBe(nbsp("€ 15.000,00"));
  });

  it("toont negatieve bedragen (bijv. creditnota)", () => {
    expect(formatEuro(-5000)).toBe(nbsp("€ -50,00"));
  });

  it("weigert bedragen die geen hele centen zijn", () => {
    expect(() => formatEuro(12.5)).toThrow(TypeError);
  });
});

describe("formatEuro zonder centen", () => {
  it("rondt af op hele euro's voor overzichtscijfers", () => {
    expect(formatEuro(48958000, { centen: false })).toBe(nbsp("€ 489.580"));
    expect(formatEuro(123456, { centen: false })).toBe(nbsp("€ 1.235"));
  });
});

describe("formatEuroVerschil", () => {
  it("toont het teken expliciet", () => {
    expect(formatEuroVerschil(458000, { centen: false })).toBe(
      nbsp("+ € 4.580"),
    );
    expect(formatEuroVerschil(-122000, { centen: false })).toBe(
      nbsp("\u2212 € 1.220"),
    );
    expect(formatEuroVerschil(0)).toBe(nbsp("€ 0,00"));
  });
});

describe("formatEuroKort", () => {
  it("geeft compacte asnotatie", () => {
    expect(formatEuroKort(0)).toBe(nbsp("€ 0"));
    expect(formatEuroKort(2000000)).toBe(nbsp("€ 20k"));
    expect(formatEuroKort(6148000)).toBe(nbsp("€ 61,5k"));
    expect(formatEuroKort(150000000)).toBe(nbsp("€ 1,5 mln"));
  });
});

describe("parseEuro", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,5", 123450],
    ["€ 12", 1200],
    ["-50,00", -5000],
    ["1234.56", 123456],
    ["1.234", 123400],
    ["15.000", 1500000],
    ["0,01", 1],
  ])("%s → %i centen", (invoer, verwacht) => {
    expect(parseEuro(invoer)).toBe(verwacht);
  });

  it.each(["", "abc", "12,345", "1,2,3", "€"])("weigert %j", (invoer) => {
    expect(parseEuro(invoer)).toBeNull();
  });

  it("vermijdt afrondingsfouten van kommagetallen", () => {
    expect(parseEuro("0,10")! + parseEuro("0,20")!).toBe(parseEuro("0,30"));
  });
});

describe("formatDatum", () => {
  it("toont een databasedatum als DD-MM-JJJJ zonder verschuiving", () => {
    expect(formatDatum("2026-11-26")).toBe("26-11-2026");
    expect(formatDatum("2027-01-01")).toBe("01-01-2027");
  });

  it("rekent tijdstippen om naar Nederlandse tijd", () => {
    // 23:30 UTC op 31 december is al 1 januari in Amsterdam.
    expect(formatDatum("2026-12-31T23:30:00Z")).toBe("01-01-2027");
    expect(formatDatum(new Date("2026-06-15T10:00:00Z"))).toBe("15-06-2026");
  });

  it("weigert een ongeldige datum", () => {
    expect(() => formatDatum("geen datum")).toThrow(RangeError);
  });
});
