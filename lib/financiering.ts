/*
 * Pure hulpjes voor de financiering (fase 9). Bedragen in centen.
 * De rekenlogica zelf (saldo per bron, financiële ruimte) staat in
 * lib/finance; dit zijn alleen de regels voor invoer en weergave.
 */
import type { DeclaratieStatus } from "./labels";

/**
 * Een hypotheek met bouwdepot bestaat uit twee delen: het bouwdepot en de
 * overige hypotheekruimte. Samen precies het hypotheekbedrag.
 */
export function hypotheekDelen(
  totaal: number,
  bouwdepot: number | null,
): { depot: number; overig: number } | null | { fout: string } {
  if (bouwdepot === null || bouwdepot === 0) return null;
  if (bouwdepot < 0) return { fout: "Het bouwdepot kan niet negatief zijn." };
  if (bouwdepot > totaal) {
    return { fout: "Het bouwdepot is hoger dan het hypotheekbedrag." };
  }
  return { depot: bouwdepot, overig: totaal - bouwdepot };
}

export type DepotStand = {
  /** Uit het bouwdepot betaald (ook buiten declaraties om). */
  uitbetaald: number;
  /** Ingediend bij de bank, nog niet uitbetaald. */
  ingediend: number;
  /** Klaargezet, nog niet ingediend. */
  concept: number;
  /** Nog niet uitbetaald en nog niet gedeclareerd. */
  vrij: number;
};

/** Stand van een bouwdepot: wat is betaald, wat loopt nog, wat is vrij. */
export function depotStand(
  depot: { bedrag: number; betaald: number },
  declaraties: { status: DeclaratieStatus; bedrag: number }[],
): DepotStand {
  const som = (s: DeclaratieStatus) =>
    declaraties.filter((d) => d.status === s).reduce((a, d) => a + d.bedrag, 0);
  const ingediend = som("ingediend");
  const concept = som("concept");
  return {
    uitbetaald: depot.betaald,
    ingediend,
    concept,
    vrij: depot.bedrag - depot.betaald - ingediend - concept,
  };
}

/**
 * Hoeveel er van een factuur nog in een declaratie kan: het totaal min wat
 * er al in andere (niet afgewezen) declaraties zit.
 */
export function declarabel(totaal: number, alGedeclareerd: number): number {
  return Math.max(0, totaal - alGedeclareerd);
}

/** Dagen tot een datum (negatief = verstreken); null zonder datum. */
export function dagenTot(datum: string | null, vandaag: string): number | null {
  if (!datum) return null;
  const dag = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 86_400_000;
  return Math.round(dag(datum) - dag(vandaag));
}
