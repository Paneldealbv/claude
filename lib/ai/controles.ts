/*
 * Controles op een AI-voorstel, los van wat de AI zelf zegt
 * (docs/ARCHITECTUUR.md § 5). Pure functies: geen database, geen AI.
 *
 * - Verplichte gegevens: leverancier, datum, totaal, minstens één regel; bij
 *   facturen ook documentnummer en vervaldatum (of betaaltermijn).
 * - Rekenkundig: per regel excl. + BTW = incl. (1 cent marge), som van de
 *   regels = totaal op het document, BTW per tarief klopt (1 cent per regel).
 * - Zekerheid onder 85% is alleen een indicatieve waarschuwing.
 * - Duplicaten: zelfde leverancier + nummer, of zelfde leverancier + bedrag
 *   binnen 7 dagen.
 */
import { isBtwTarief, vanafInclusief } from "@/lib/btw";
import { isGeldigeIsoDatum } from "@/lib/datum";
import { formatDatum, formatEuro } from "@/lib/format";
import type { Aandachtspunt, Herkenning } from "./schema";

export const ZEKERHEID_DREMPEL = 0.85;

/** Euro's (getal) naar hele centen; null bij geen of ongeldige waarde. */
export function naarCenten(euro: number | null | undefined): number | null {
  if (euro === null || euro === undefined || !Number.isFinite(euro)) {
    return null;
  }
  return Math.round(euro * 100);
}

/** BTW-tarief in procenten (21) naar basispunten (2100); null als ongeldig. */
export function tariefBp(procent: number | null | undefined): number | null {
  if (procent === null || procent === undefined) return null;
  // Soms komt een fractie terug (0,21 in plaats van 21).
  const p = procent > 0 && procent < 1 ? procent * 100 : procent;
  const bp = Math.round(p * 100);
  return isBtwTarief(bp) ? bp : null;
}

export type BestaandDocument = {
  id: string;
  leverancierId: string | null;
  nummer: string | null;
  datum: string;
  /** Centen incl. BTW, zoals opgeslagen (creditnota negatief). */
  totaal: number;
  status: string;
};

const dagenTussen = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000,
  );

const procent = (z: number) =>
  `${Math.round(Math.max(0, Math.min(1, z)) * 100)}%`;

const VELDNAMEN: Record<string, string> = {
  soort: "Soort document",
  leverancier: "Leverancier",
  documentnummer: "Documentnummer",
  documentdatum: "Datum",
  vervaldatum: "Vervaldatum",
  totaal_incl: "Totaal",
  totaal_btw: "BTW-totaal",
  contract_id: "Contract",
};

export function controleer(
  h: Herkenning,
  ctx: {
    leverancierId: string | null;
    bestaande: BestaandDocument[];
    vandaag: string;
  },
): Aandachtspunt[] {
  const punten: Aandachtspunt[] = [];
  const voeg = (p: Aandachtspunt) => punten.push(p);

  if (!h.is_document) {
    voeg({
      soort: "ontbreekt",
      veld: "document",
      tekst:
        "Dit lijkt geen factuur of bon. Controleer of het juiste bestand is gekozen.",
    });
    return punten;
  }

  const soort = h.soort.waarde ?? "factuur";
  const isBon = soort === "bon";
  const datum = h.documentdatum.waarde;
  const totaal = naarCenten(h.totaal_incl.waarde);

  // 1. Verplichte gegevens ---------------------------------------------------
  if (!h.leverancier.waarde?.trim()) {
    voeg({
      soort: isBon ? "onzeker" : "ontbreekt",
      veld: "leverancier",
      tekst: isBon
        ? "Winkel niet gevonden op de bon; vul hem in als je wilt."
        : "Leverancier ontbreekt.",
    });
  }
  if (!datum || !isGeldigeIsoDatum(datum)) {
    voeg({
      soort: "ontbreekt",
      veld: "documentdatum",
      tekst: "Datum ontbreekt.",
    });
  }
  if (totaal === null) {
    voeg({
      soort: "ontbreekt",
      veld: "totaal_incl",
      tekst: "Totaalbedrag ontbreekt.",
    });
  }
  if (!h.regels.length) {
    voeg({
      soort: "ontbreekt",
      veld: "regels",
      tekst: "Geen regels gevonden.",
    });
  }
  if (!isBon && !h.documentnummer.waarde?.trim()) {
    voeg({
      soort: "ontbreekt",
      veld: "documentnummer",
      tekst: "Factuurnummer ontbreekt.",
    });
  }
  if (
    !isBon &&
    soort !== "creditnota" &&
    !h.vervaldatum.waarde &&
    h.betaaltermijn_dagen.waarde === null
  ) {
    voeg({
      soort: "ontbreekt",
      veld: "vervaldatum",
      tekst: "Vervaldatum of betaaltermijn ontbreekt.",
    });
  }

  // 2. Rekenkundige controles -------------------------------------------------
  let som = 0;
  let somCompleet = true;
  h.regels.forEach((r, i) => {
    const nr = i + 1;
    const incl = naarCenten(r.bedrag_incl);
    const bp = tariefBp(r.btw_tarief);
    if (incl === null) {
      somCompleet = false;
      voeg({
        soort: "ontbreekt",
        veld: `regel-${nr}`,
        tekst: `Regel ${nr} heeft geen bedrag.`,
      });
    } else {
      som += incl;
    }
    if (bp === null) {
      voeg({
        soort: "klopt-niet",
        veld: `regel-${nr}`,
        tekst:
          r.btw_tarief === null
            ? `Regel ${nr}: BTW-tarief ontbreekt.`
            : `Regel ${nr}: BTW-tarief ${r.btw_tarief}% bestaat niet (0, 9 of 21%).`,
      });
    }
    const excl = naarCenten(r.bedrag_excl);
    if (incl !== null && excl !== null && bp !== null) {
      const verwacht = excl + Math.round((excl * bp) / 10_000);
      if (Math.abs(verwacht - incl) > 1) {
        voeg({
          soort: "klopt-niet",
          veld: `regel-${nr}`,
          tekst: `Regel ${nr}: ${formatEuro(excl)} excl. + ${bp / 100}% BTW is ${formatEuro(verwacht)}, niet ${formatEuro(incl)}.`,
        });
      }
    }
    if (!r.categorie_id && !r.contract_regel_id) {
      voeg({
        soort: "ontbreekt",
        veld: `regel-${nr}`,
        tekst: `Regel ${nr}: kies waar deze kosten bij horen.`,
      });
    }
  });
  if (totaal !== null && h.regels.length && somCompleet && som !== totaal) {
    voeg({
      soort: "klopt-niet",
      veld: "totaal_incl",
      tekst: `De regels tellen op tot ${formatEuro(som)}, het totaal op het document is ${formatEuro(totaal)}.`,
    });
  }

  // BTW per tarief: som van de regels met dat tarief (1 cent marge per regel).
  for (const t of h.btw_per_tarief) {
    const bp = tariefBp(t.tarief);
    const opgegeven = naarCenten(t.btw);
    if (bp === null || opgegeven === null) continue;
    const regels = h.regels.filter((r) => tariefBp(r.btw_tarief) === bp);
    if (!regels.length) continue;
    const berekend = regels.reduce((a, r) => {
      const incl = naarCenten(r.bedrag_incl);
      return incl === null
        ? a
        : a + vanafInclusief(incl, bp as 0 | 900 | 2100).btw;
    }, 0);
    if (Math.abs(berekend - opgegeven) > regels.length) {
      voeg({
        soort: "klopt-niet",
        veld: "totaal_btw",
        tekst: `BTW ${bp / 100}%: volgens de regels ${formatEuro(berekend)}, op het document ${formatEuro(opgegeven)}.`,
      });
    }
  }
  const btwTotaal = naarCenten(h.totaal_btw.waarde);
  const perTarief = h.btw_per_tarief
    .map((t) => naarCenten(t.btw))
    .filter((b): b is number => b !== null);
  if (btwTotaal !== null && perTarief.length) {
    const somTarieven = perTarief.reduce((a, b) => a + b, 0);
    if (Math.abs(somTarieven - btwTotaal) > 1) {
      voeg({
        soort: "klopt-niet",
        veld: "totaal_btw",
        tekst: `De BTW per tarief telt op tot ${formatEuro(somTarieven)}, het BTW-totaal is ${formatEuro(btwTotaal)}.`,
      });
    }
  }

  // 3. Datums -----------------------------------------------------------------
  const verval = h.vervaldatum.waarde;
  if (datum && isGeldigeIsoDatum(datum) && datum > ctx.vandaag) {
    voeg({
      soort: "onzeker",
      veld: "documentdatum",
      tekst: `De datum ${formatDatum(datum)} ligt in de toekomst.`,
    });
  }
  if (verval && !isGeldigeIsoDatum(verval)) {
    voeg({
      soort: "klopt-niet",
      veld: "vervaldatum",
      tekst: "Vervaldatum is geen geldige datum.",
    });
  } else if (verval && datum && isGeldigeIsoDatum(datum) && verval < datum) {
    voeg({
      soort: "klopt-niet",
      veld: "vervaldatum",
      tekst: "De vervaldatum ligt vóór de datum van het document.",
    });
  }

  // 4. Zekerheid (indicatief) -------------------------------------------------
  for (const [sleutel, label] of Object.entries(VELDNAMEN)) {
    const v = h[sleutel as keyof Herkenning] as {
      waarde: unknown;
      zekerheid: number;
    };
    if (v.waarde !== null && v.zekerheid < ZEKERHEID_DREMPEL) {
      voeg({
        soort: "onzeker",
        veld: sleutel,
        tekst: `${label}: ${procent(v.zekerheid)} zeker; controleer dit.`,
      });
    }
  }
  h.regels.forEach((r, i) => {
    if (r.zekerheid < ZEKERHEID_DREMPEL) {
      voeg({
        soort: "onzeker",
        veld: `regel-${i + 1}`,
        tekst: `Regel ${i + 1}: ${procent(r.zekerheid)} zeker; controleer dit.`,
      });
    }
  });

  // 5. Duplicaten -------------------------------------------------------------
  const nummer = h.documentnummer.waarde?.trim().toLowerCase();
  if (ctx.leverancierId) {
    const actief = ctx.bestaande.filter(
      (d) => d.leverancierId === ctx.leverancierId && d.status !== "vervallen",
    );
    const zelfdeNummer = nummer
      ? actief.find((d) => d.nummer?.trim().toLowerCase() === nummer)
      : undefined;
    if (zelfdeNummer) {
      voeg({
        soort: "duplicaat",
        veld: "documentnummer",
        tekst: `Er staat al een document met nummer ${h.documentnummer.waarde} van deze leverancier.`,
        href: `/documenten/${zelfdeNummer.id}`,
      });
    }
    if (totaal !== null && datum && isGeldigeIsoDatum(datum)) {
      const bedrag = soort === "creditnota" ? -totaal : totaal;
      for (const d of actief) {
        if (
          d !== zelfdeNummer &&
          d.totaal === bedrag &&
          Math.abs(dagenTussen(d.datum, datum)) <= 7
        ) {
          voeg({
            soort: "duplicaat",
            veld: "totaal_incl",
            tekst: `Mogelijk dubbel: zelfde bedrag bij deze leverancier op ${formatDatum(d.datum)}.`,
            href: `/documenten/${d.id}`,
          });
        }
      }
    }
  }

  return punten;
}

/** Leverancier zoeken op KvK, IBAN, BTW-nummer of (deel van de) naam. */
export function zoekLeverancier(
  h: Herkenning,
  leveranciers: {
    id: string;
    naam: string;
    kvk: string | null;
    iban: string | null;
    btwNummer: string | null;
  }[],
): string | null {
  const code = (s: string | null | undefined) =>
    (s ?? "").replace(/[\s.\-]/g, "").toUpperCase();
  const naam = (s: string | null | undefined) =>
    (s ?? "")
      .toLowerCase()
      .replace(/\b(b\.?\s?v\.?|v\.?\s?o\.?\s?f\.?|n\.?\s?v\.?)$/g, "")
      .replace(/[^a-z0-9]/g, "");
  const kvk = code(h.leverancier_kvk.waarde);
  const iban = code(h.leverancier_iban.waarde);
  const btw = code(h.leverancier_btw_nummer.waarde);
  const gezocht = naam(h.leverancier.waarde);
  return (
    (kvk && leveranciers.find((l) => code(l.kvk) === kvk)?.id) ||
    (iban && leveranciers.find((l) => code(l.iban) === iban)?.id) ||
    (btw && leveranciers.find((l) => code(l.btwNummer) === btw)?.id) ||
    (gezocht.length >= 3 &&
      (leveranciers.find((l) => naam(l.naam) === gezocht)?.id ||
        leveranciers.find((l) => {
          const n = naam(l.naam);
          return n.length >= 4 && (n.includes(gezocht) || gezocht.includes(n));
        })?.id)) ||
    null
  );
}
