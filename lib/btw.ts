/**
 * BTW-berekeningen in hele centen.
 *
 * De gebruiker voert bedragen standaard INCLUSIEF BTW in. De database bewaart
 * excl., BTW en incl., met de controle incl = excl + btw. BTW-tarieven in
 * basispunten: 2100 = 21%, 900 = 9%, 0 = 0%.
 */
import type { Cent } from "@/lib/finance";

export const BTW_TARIEVEN = [
  { bp: 2100, label: "21%" },
  { bp: 900, label: "9%" },
  { bp: 0, label: "0%" },
] as const;

export type BtwTarief = (typeof BTW_TARIEVEN)[number]["bp"];

export type BtwBedrag = { excl: Cent; btw: Cent; incl: Cent };

/** Afronden naar hele centen, symmetrisch rond 0 (−2,5 → −3). */
function rond(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

function controleer(bedrag: Cent, tariefBp: number) {
  if (!Number.isSafeInteger(bedrag)) {
    throw new TypeError(`Bedrag moet in hele centen zijn, kreeg: ${bedrag}`);
  }
  if (!BTW_TARIEVEN.some((t) => t.bp === tariefBp)) {
    throw new RangeError(`Onbekend BTW-tarief: ${tariefBp}`);
  }
}

/** Splitst een bedrag inclusief BTW in excl. en BTW (BTW op hele centen). */
export function vanafInclusief(incl: Cent, tariefBp: BtwTarief): BtwBedrag {
  controleer(incl, tariefBp);
  const excl = rond((incl * 10_000) / (10_000 + tariefBp));
  return { excl, btw: incl - excl, incl };
}

/** Berekent BTW en totaal bij een bedrag exclusief BTW. */
export function vanafExclusief(excl: Cent, tariefBp: BtwTarief): BtwBedrag {
  controleer(excl, tariefBp);
  const btw = rond((excl * tariefBp) / 10_000);
  return { excl, btw, incl: excl + btw };
}

export function isBtwTarief(waarde: number): waarde is BtwTarief {
  return BTW_TARIEVEN.some((t) => t.bp === waarde);
}
