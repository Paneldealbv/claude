import "server-only";
import ExcelJS from "exceljs";
export { naarCsv } from "./csv";
import { isoNaarNl } from "@/lib/datum";
import type { Rapport } from "@/lib/rapportages";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Excel-werkmap met één tabblad per rapport; echte getallen en datums. */
export async function naarExcel(
  rapporten: Rapport[],
  meta: { project: string; datum: string },
): Promise<ExcelJS.Buffer> {
  const werkmap = new ExcelJS.Workbook();
  werkmap.creator = "Nieuwbouw Dashboard";
  werkmap.created = new Date();
  const EURO = '"€" #,##0.00;[Red]-"€" #,##0.00';

  for (const rapport of rapporten) {
    const blad = werkmap.addWorksheet(rapport.tabblad.slice(0, 31), {
      views: [{ state: "frozen", ySplit: 4 }],
    });
    blad.addRow([rapport.titel]).font = { bold: true, size: 14 };
    blad.addRow([
      `${meta.project} · ${isoNaarNl(meta.datum)} · bedragen incl. BTW`,
    ]).font = { color: { argb: "FF696B70" } };
    blad.addRow([]);
    const kop = blad.addRow(rapport.kolommen.map((k) => k.label));
    kop.font = { bold: true };
    kop.eachCell((c) => {
      c.border = { bottom: { style: "thin", color: { argb: "FFD6D2C8" } } };
    });
    blad.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: rapport.kolommen.length },
    };

    rapport.kolommen.forEach((k, i) => {
      const langste = Math.max(
        k.label.length,
        ...rapport.rijen.map((r) => String(r.cellen[i] ?? "").length),
      );
      blad.getColumn(i + 1).width =
        k.soort === "bedrag"
          ? 16
          : k.soort === "datum"
            ? 13
            : k.soort === "getal"
              ? Math.max(11, k.label.length + 2)
              : Math.min(48, Math.max(12, langste + 2));
    });

    for (const r of rapport.rijen) {
      const rij = blad.addRow(
        r.cellen.map((w, i) => {
          const soort = rapport.kolommen[i].soort;
          if (w === null || w === "") return null;
          if (soort === "bedrag" && typeof w === "number") return w / 100;
          if (soort === "datum" && typeof w === "string" && ISO.test(w)) {
            return new Date(`${w}T00:00:00Z`);
          }
          return w;
        }),
      );
      rapport.kolommen.forEach((k, i) => {
        const c = rij.getCell(i + 1);
        if (k.soort === "bedrag") c.numFmt = EURO;
        if (k.soort === "datum") c.numFmt = "dd-mm-yyyy";
      });
      if (rapport.boom && r.niveau === 1) {
        rij.getCell(2).alignment = { indent: 1 };
      }
      if (r.totaal || (rapport.boom && r.niveau === 0)) {
        rij.font = { bold: true };
      }
      if (r.totaal) {
        rij.eachCell({ includeEmpty: true }, (c) => {
          c.border = { top: { style: "thin" } };
        });
      }
    }
  }
  return werkmap.xlsx.writeBuffer();
}
