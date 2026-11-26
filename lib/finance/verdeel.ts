import type { Cent } from "./types";

/**
 * Verdeelt een bedrag in hele centen naar rato van gewichten, met de
 * grootste-restmethode. De delen tellen altijd exact op tot het totaal.
 *
 * - Rekent intern met BigInt, zodat ook grote bedragen × grote gewichten
 *   exact blijven.
 * - Gewichten mogen negatief zijn (bijv. een bon met een retourregel), zolang
 *   ze samen niet 0 zijn; het resultaat is dan exact evenredig met de
 *   gewichten.
 * - Tellen de gewichten samen op tot 0, dan wordt verdeeld naar de absolute
 *   gewichten; zijn die ook allemaal 0, dan in gelijke delen.
 * - Bij gelijke resten krijgt het eerste element de extra cent, zodat de
 *   uitkomst altijd hetzelfde is.
 *
 * Voorbeeld: verdeel(100, [1, 1, 1]) → [34, 33, 33]
 */
export function verdeel(totaal: Cent, gewichten: readonly number[]): Cent[] {
  if (!Number.isSafeInteger(totaal)) {
    throw new TypeError(`Totaal moet in hele centen zijn, kreeg: ${totaal}`);
  }
  for (const g of gewichten) {
    if (!Number.isSafeInteger(g)) {
      throw new TypeError(`Gewichten moeten hele getallen zijn, kreeg: ${g}`);
    }
  }
  const n = gewichten.length;
  if (n === 0) {
    if (totaal !== 0) {
      throw new RangeError("Kan een bedrag niet over nul delen verdelen");
    }
    return [];
  }

  let w = gewichten.map((g) => BigInt(g));
  let som = w.reduce((a, b) => a + b, 0n);
  if (som === 0n) {
    w = w.map((g) => (g < 0n ? -g : g));
    som = w.reduce((a, b) => a + b, 0n);
    if (som === 0n) {
      w = w.map(() => 1n);
      som = BigInt(n);
    }
  }
  if (som < 0n) {
    w = w.map((g) => -g);
    som = -som;
  }

  const t = BigInt(totaal);
  const delen: bigint[] = [];
  const resten: bigint[] = [];
  for (const g of w) {
    const teller = t * g;
    let q = teller / som; // BigInt-deling rondt af richting 0
    if (teller % som !== 0n && teller < 0n) q -= 1n; // → afronden naar beneden
    delen.push(q);
    resten.push(teller - q * som); // altijd 0 ≤ rest < som
  }

  let over = t - delen.reduce((a, b) => a + b, 0n);
  const volgorde = resten
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (let k = 0; over > 0n; k++, over--) {
    delen[volgorde[k % n].i] += 1n;
  }

  return delen.map((d) => Number(d));
}

/** Som van bedragen in centen. */
export function som(bedragen: Iterable<Cent>): Cent {
  let totaal = 0;
  for (const b of bedragen) totaal += b;
  return totaal;
}
