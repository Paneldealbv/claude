/**
 * Datums invoeren en controleren in de Nederlandse notatie DD-MM-JJJJ.
 *
 * In de database en tussen browser en server gebruiken we altijd ISO
 * (JJJJ-MM-DD). Op het scherm altijd DD-MM-JJJJ, ongeacht de taal van de
 * browser.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Bestaat deze kalenderdatum echt (rekening houdend met schrikkeljaren)? */
function bestaat(jaar: number, maand: number, dag: number): boolean {
  if (jaar < 1900 || jaar > 2100 || maand < 1 || maand > 12 || dag < 1) {
    return false;
  }
  const d = new Date(Date.UTC(jaar, maand - 1, dag));
  return (
    d.getUTCFullYear() === jaar &&
    d.getUTCMonth() === maand - 1 &&
    d.getUTCDate() === dag
  );
}

const iso = (jaar: number, maand: number, dag: number) =>
  `${String(jaar).padStart(4, "0")}-${String(maand).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;

/** Is dit een geldige ISO-datum (JJJJ-MM-DD) die echt bestaat? */
export function isGeldigeIsoDatum(waarde: string): boolean {
  const m = ISO.exec(waarde);
  return Boolean(m && bestaat(Number(m[1]), Number(m[2]), Number(m[3])));
}

/**
 * Leest een door de gebruiker getypte datum en geeft ISO terug, of null als
 * het geen geldige datum is. Toegestaan:
 *   "15-05-2027", "15-5-2027", "15/05/2027", "15.05.2027", "15 5 2027",
 *   "15052027", "150527" en jaartallen met twee cijfers ("15-05-27" → 2027).
 */
export function parseDatum(invoer: string): string | null {
  const tekst = invoer.trim();
  if (!tekst) return null;

  let dag: number;
  let maand: number;
  let jaar: number;

  const delen = tekst.split(/\s*[-/.\s]\s*/);
  if (delen.length === 3 && delen.every((d) => /^\d+$/.test(d))) {
    const [d, m, j] = delen;
    if (d.length > 2 || m.length > 2 || (j.length !== 2 && j.length !== 4)) {
      return null;
    }
    dag = Number(d);
    maand = Number(m);
    jaar = Number(j.length === 2 ? `20${j}` : j);
  } else if (/^\d{8}$/.test(tekst) || /^\d{6}$/.test(tekst)) {
    dag = Number(tekst.slice(0, 2));
    maand = Number(tekst.slice(2, 4));
    const j = tekst.slice(4);
    jaar = Number(j.length === 2 ? `20${j}` : j);
  } else {
    return null;
  }

  return bestaat(jaar, maand, dag) ? iso(jaar, maand, dag) : null;
}

/** ISO (JJJJ-MM-DD) → DD-MM-JJJJ; lege of ongeldige invoer → "". */
export function isoNaarNl(waarde: string | null | undefined): string {
  if (!waarde || !isGeldigeIsoDatum(waarde)) return "";
  const [j, m, d] = waarde.split("-");
  return `${d}-${m}-${j}`;
}

/** De datum van vandaag in Nederland, als JJJJ-MM-DD. */
export function vandaagIso(nu: Date = new Date()): string {
  const delen = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Amsterdam",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(nu)
      .map((d) => [d.type, d.value]),
  );
  return `${delen.year}-${delen.month}-${delen.day}`;
}
