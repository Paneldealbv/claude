/*
 * Van AI-voorstel naar een vooringevuld documentformulier. Pure functies.
 * Id's uit het antwoord worden alleen gebruikt als ze bij dit project horen
 * en bij elkaar passen (contract bij de leverancier, termijn bij het
 * contract, contractregel bij het contract).
 */
import { naarCenten, tariefBp } from "./controles";
import type { Aandachtspunt, Herkenning } from "./schema";

export type Geldig = {
  categorieen: Set<string>;
  ruimtes: Set<string>;
  contracten: Map<
    string,
    {
      leverancierId: string | null;
      regels: Set<string>;
      termijnen: Set<string>;
    }
  >;
};

/** Verwijdert id's die niet bestaan of niet bij elkaar passen. */
export function zuiverIds(
  h: Herkenning,
  geldig: Geldig,
  leverancierId: string | null,
): Herkenning {
  const past = (id: string | null) => {
    if (!id) return false;
    const c = geldig.contracten.get(id);
    return Boolean(
      c &&
      (!leverancierId || !c.leverancierId || c.leverancierId === leverancierId),
    );
  };
  // Contract: het voorgestelde, of anders dat van een genoemde contractregel.
  let contractId = past(h.contract_id.waarde) ? h.contract_id.waarde : null;
  if (!contractId) {
    for (const r of h.regels) {
      const id = [...geldig.contracten.entries()].find(
        ([cid, c]) =>
          r.contract_regel_id && c.regels.has(r.contract_regel_id) && past(cid),
      )?.[0];
      if (id) {
        contractId = id;
        break;
      }
    }
  }
  const contract = contractId ? geldig.contracten.get(contractId) : undefined;
  return {
    ...h,
    contract_id: { ...h.contract_id, waarde: contractId },
    termijn_id: {
      ...h.termijn_id,
      waarde:
        contract &&
        h.termijn_id.waarde &&
        contract.termijnen.has(h.termijn_id.waarde)
          ? h.termijn_id.waarde
          : null,
    },
    regels: h.regels.map((r) => ({
      ...r,
      categorie_id:
        r.categorie_id && geldig.categorieen.has(r.categorie_id)
          ? r.categorie_id
          : null,
      ruimte_id:
        r.ruimte_id && geldig.ruimtes.has(r.ruimte_id) ? r.ruimte_id : null,
      contract_regel_id:
        contract &&
        r.contract_regel_id &&
        contract.regels.has(r.contract_regel_id)
          ? r.contract_regel_id
          : null,
    })),
  };
}

const plusDagen = (iso: string, dagen: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(dagen));
  return d.toISOString().slice(0, 10);
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type VoorstelInvoer = {
  type: "factuur" | "termijnfactuur" | "eindfactuur" | "creditnota" | "bon";
  leverancierId: string | null;
  /** Naam om als nieuwe leverancier voor te stellen (geen match gevonden). */
  nieuweLeverancier: string | null;
  contractId: string | null;
  termijnId: string | null;
  nummer: string | null;
  datum: string | null;
  vervalDatum: string | null;
  /** Centen, zoals op het papier (bij een creditnota positief). */
  totaalOpDocument: number | null;
  regels: {
    omschrijving: string;
    doel: string;
    bedrag: number | null;
    btw: number;
    ruimtes: string[];
  }[];
};

/** Vult het documentformulier met het (gezuiverde) voorstel. */
export function voorstelNaarInvoer(
  h: Herkenning,
  leverancierId: string | null,
): VoorstelInvoer {
  const datum =
    h.documentdatum.waarde && ISO.test(h.documentdatum.waarde)
      ? h.documentdatum.waarde
      : null;
  const verval =
    h.vervaldatum.waarde && ISO.test(h.vervaldatum.waarde)
      ? h.vervaldatum.waarde
      : datum && h.betaaltermijn_dagen.waarde
        ? plusDagen(datum, h.betaaltermijn_dagen.waarde)
        : null;
  const contractId = h.contract_id.waarde;
  const soort = h.soort.waarde ?? "factuur";
  return {
    type: soort,
    leverancierId,
    nieuweLeverancier: leverancierId
      ? null
      : h.leverancier.waarde?.trim() || null,
    contractId,
    termijnId: h.termijn_id.waarde,
    nummer: h.documentnummer.waarde?.trim() || null,
    datum,
    vervalDatum: soort === "bon" ? null : verval,
    totaalOpDocument: naarCenten(h.totaal_incl.waarde),
    regels: h.regels.map((r) => ({
      omschrijving: r.omschrijving.trim(),
      doel: r.contract_regel_id
        ? `r:${r.contract_regel_id}`
        : r.categorie_id
          ? `k:${r.categorie_id}`
          : contractId
            ? `c:${contractId}`
            : "",
      bedrag: naarCenten(r.bedrag_incl),
      btw: tariefBp(r.btw_tarief) ?? 2100,
      ruimtes: r.ruimte_id ? [r.ruimte_id] : [],
    })),
  };
}

/** Velden van het documentformulier waar een aandachtspunt bij kan staan. */
export type FormulierVeld =
  | "soort"
  | "leverancier"
  | "contract"
  | "nummer"
  | "datum"
  | "vervalDatum"
  | "totaal"
  | "regels";

const NAAR_FORMULIER: Record<string, FormulierVeld> = {
  soort: "soort",
  leverancier: "leverancier",
  contract_id: "contract",
  termijn_id: "contract",
  documentnummer: "nummer",
  documentdatum: "datum",
  vervaldatum: "vervalDatum",
  totaal_incl: "totaal",
  totaal_btw: "totaal",
  regels: "regels",
};

/**
 * Aandachtspunten per formulierveld, om ze bij het veld te tonen. Mogelijke
 * duplicaten (met link) en punten over het hele document staan alleen in de
 * lijst bovenaan.
 */
export function letOpPerVeld(
  punten: Aandachtspunt[],
): Partial<Record<FormulierVeld, string[]>> {
  const uit: Partial<Record<FormulierVeld, string[]>> = {};
  for (const p of punten) {
    if (p.soort === "duplicaat") continue;
    const veld = p.veld.startsWith("regel-")
      ? "regels"
      : NAAR_FORMULIER[p.veld];
    if (veld) (uit[veld] ??= []).push(p.tekst);
  }
  return uit;
}

/** Zo lang "bezig" betekent dat het uitlezen is afgebroken (time-out). */
const VASTGELOPEN_NA_MS = 2 * 60 * 1000;

/** Uitlezen dat nooit is afgerond (bijv. de serverfunctie werd gestopt). */
export function isVastgelopen(
  status: string,
  bijgewerkt: string,
  nu = Date.now(),
) {
  return (
    (status === "bezig" || status === "wachtrij") &&
    nu - new Date(bijgewerkt).getTime() > VASTGELOPEN_NA_MS
  );
}
