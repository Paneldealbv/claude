import { describe, expect, it } from "vitest";
import { naarCsv } from "./csv";
import type { Rapport } from "./rapportages";

const rapport = (rijen: Rapport["rijen"]): Rapport => ({
  sleutel: "betalingen",
  titel: "Test",
  tabblad: "Test",
  omschrijving: "",
  kolommen: [
    { label: "Datum", soort: "datum" },
    { label: "Omschrijving", soort: "tekst" },
    { label: "Aantal", soort: "getal" },
    { label: "Bedrag", soort: "bedrag" },
  ],
  rijen,
});

const regels = (csv: string) => csv.replace(/^﻿/, "").split("\r\n");

describe("CSV voor Nederlandse Excel", () => {
  it("begint met een BOM, gebruikt puntkomma's en een decimale komma", () => {
    const csv = naarCsv(
      rapport([{ cellen: ["2026-11-10", "Termijn 1", 1, 810000] }]),
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(regels(csv)).toEqual([
      "Datum;Omschrijving;Aantal;Bedrag",
      "10-11-2026;Termijn 1;1;8100,00",
      "",
    ]);
  });

  it("negatieve bedragen en centen exact", () => {
    const csv = naarCsv(
      rapport([
        { cellen: ["2026-11-26", "Creditnota", null, -35000] },
        { cellen: ["2026-11-26", "Bon", null, 19050] },
        { cellen: ["2026-11-26", "Afronding", null, 1] },
      ]),
    );
    expect(regels(csv).slice(1, 4)).toEqual([
      "26-11-2026;Creditnota;;-350,00",
      "26-11-2026;Bon;;190,50",
      "26-11-2026;Afronding;;0,01",
    ]);
  });

  it("zet tekst met puntkomma, aanhalingsteken of regeleinde tussen aanhalingstekens", () => {
    const csv = naarCsv(
      rapport([{ cellen: [null, 'Tegels; "wit"\nmat', null, null] }]),
    );
    expect(csv).toContain(';"Tegels; ""wit""\nmat";;');
  });

  it("voert tekst die op een formule lijkt nooit uit", () => {
    const csv = naarCsv(
      rapport([
        { cellen: [null, '=HYPERLINK("x")', null, null] },
        { cellen: [null, "+31 6 1234", null, null] },
        { cellen: [null, "@SOM", null, null] },
      ]),
    );
    const r = regels(csv);
    expect(r[1]).toBe(';"\'=HYPERLINK(""x"")";;');
    expect(r[2]).toBe(";'+31 6 1234;;");
    expect(r[3]).toBe(";'@SOM;;");
  });

  it("laat tekst in een datumkolom (bijv. Totaal) staan", () => {
    const csv = naarCsv(
      rapport([{ cellen: ["Totaal", "", null, 100], totaal: true }]),
    );
    expect(regels(csv)[1]).toBe("Totaal;;;1,00");
  });
});
