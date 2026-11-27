import { isoNaarNl } from "@/lib/datum";
import type { Rapport } from "@/lib/rapportages";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * CSV voor Nederlandse Excel: puntkomma's, decimale komma, UTF-8 met BOM
 * (zodat € en accenten goed overkomen). Bedragen zonder €-teken, zodat Excel
 * ze als getal herkent.
 */
export function naarCsv(rapport: Rapport): string {
  const tekst = (w: string) => {
    // Tekst die met = + - @ begint niet als formule laten uitvoeren.
    const veilig = /^[=+\-@]/.test(w) ? `'${w}` : w;
    return /[";\r\n]/.test(veilig)
      ? `"${veilig.replaceAll('"', '""')}"`
      : veilig;
  };
  const cel = (w: string | number | null, soort: string) => {
    if (w === null || w === "") return "";
    if (typeof w === "number") {
      return soort === "bedrag"
        ? (w / 100).toFixed(2).replace(".", ",")
        : String(w);
    }
    if (soort === "datum" && ISO.test(w)) return isoNaarNl(w);
    return tekst(w);
  };
  const regels = [
    rapport.kolommen.map((k) => tekst(k.label)).join(";"),
    ...rapport.rijen.map((r) =>
      r.cellen.map((w, i) => cel(w, rapport.kolommen[i].soort)).join(";"),
    ),
  ];
  return `﻿${regels.join("\r\n")}\r\n`;
}
