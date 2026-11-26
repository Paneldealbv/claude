/**
 * Opmaak volgens de Nederlandse conventies van het Nieuwbouw Dashboard.
 *
 * - Bedragen worden overal als gehele centen (integer) opgeslagen en berekend.
 *   Alleen voor weergave zetten we ze om naar euro's.
 * - Datums tonen we als DD-MM-JJJJ.
 */

const TIJDZONE = "Europe/Amsterdam";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const euroHeelFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Formatteert een bedrag in centen als euro, bijv. 123456 → "€ 1.234,56".
 * Met `{ centen: false }` wordt afgerond op hele euro's ("€ 1.235"), bedoeld
 * voor grote overzichtscijfers. Rekenen gebeurt altijd met de exacte centen.
 */
export function formatEuro(
  centen: number,
  { centen: metCenten = true }: { centen?: boolean } = {},
): string {
  if (!Number.isInteger(centen)) {
    throw new TypeError(`Bedrag moet in hele centen zijn, kreeg: ${centen}`);
  }
  return (metCenten ? euroFormatter : euroHeelFormatter).format(centen / 100);
}

/** Bedrag met expliciet teken, voor afwijkingen: "+ € 4.580" / "− € 1.220". */
export function formatEuroVerschil(
  centen: number,
  opties?: { centen?: boolean },
): string {
  if (centen === 0) return formatEuro(0, opties);
  const teken = centen > 0 ? "+" : "\u2212";
  return `${teken}\u00a0${formatEuro(Math.abs(centen), opties)}`;
}

/** Korte notatie voor grafiekassen: 2000000 → "€ 20k", 150000000 → "€ 1,5 mln". */
export function formatEuroKort(centen: number): string {
  const euro = centen / 100;
  const abs = Math.abs(euro);
  const getal = (n: number) =>
    n.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
  if (abs >= 1_000_000) return `€\u00a0${getal(euro / 1_000_000)}\u00a0mln`;
  if (abs >= 1_000) return `€\u00a0${getal(euro / 1_000)}k`;
  return `€\u00a0${getal(euro)}`;
}

/**
 * Zet door de gebruiker ingevoerde tekst om naar centen.
 * Accepteert o.a. "1.234,56", "1234,5", "€ 12", "-50,00" en "1234.56".
 * Geeft `null` terug als de invoer geen geldig bedrag is.
 */
export function parseEuro(invoer: string): number | null {
  let tekst = invoer.replace(/€|\s/g, "");
  if (tekst === "") return null;

  const negatief = tekst.startsWith("-");
  if (negatief) tekst = tekst.slice(1);

  const laatsteKomma = tekst.lastIndexOf(",");
  const laatstePunt = tekst.lastIndexOf(".");

  let geheel: string;
  let decimalen = "";
  if (laatsteKomma > -1) {
    // Nederlandse notatie: komma is decimaalteken, punten zijn duizendtallen.
    geheel = tekst.slice(0, laatsteKomma).replace(/\./g, "");
    decimalen = tekst.slice(laatsteKomma + 1);
  } else if (laatstePunt > -1 && tekst.length - laatstePunt - 1 <= 2) {
    // "1234.56" of "12.5": punt als decimaalteken.
    geheel = tekst.slice(0, laatstePunt);
    decimalen = tekst.slice(laatstePunt + 1);
  } else {
    // "1.234" of "1.234.567": punten zijn duizendtallen.
    geheel = tekst.replace(/\./g, "");
  }

  if (!/^\d+$/.test(geheel) || !/^\d{0,2}$/.test(decimalen)) return null;

  const centen = Number(geheel) * 100 + Number(decimalen.padEnd(2, "0"));
  if (!Number.isSafeInteger(centen)) return null;
  return negatief ? -centen : centen;
}

const datumFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIJDZONE,
});

const DATUM_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formatteert een datum als DD-MM-JJJJ.
 * Een kale datum uit de database ("2026-11-26") wordt zonder tijdzone-omrekening
 * weergegeven, zodat er nooit een dag verschuift.
 */
export function formatDatum(datum: string | Date): string {
  if (typeof datum === "string") {
    const kaal = DATUM_ISO.exec(datum);
    if (kaal) return `${kaal[3]}-${kaal[2]}-${kaal[1]}`;
    datum = new Date(datum);
  }
  if (Number.isNaN(datum.getTime())) {
    throw new RangeError("Ongeldige datum");
  }
  const delen = Object.fromEntries(
    datumFormatter.formatToParts(datum).map((d) => [d.type, d.value]),
  );
  return `${delen.day}-${delen.month}-${delen.year}`;
}
