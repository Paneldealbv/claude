import { z } from "zod";

/*
 * Het voorstel zoals de app het gebruikt en bewaart (document_extractions):
 * per veld de waarde (null = niet gevonden), een zekerheid (0–1) en de tekst
 * op het document waarop het is gebaseerd. Bedragen in euro's inclusief BTW
 * (getal met punt als decimaalteken), datums als JJJJ-MM-DD. Id's komen uit
 * de lijsten die we meesturen.
 */

const veld = <T extends z.ZodType>(waarde: T) =>
  z.object({
    waarde: waarde.nullable(),
    zekerheid: z.number(),
    bron: z.string().nullable(),
  });

const SOORTEN = [
  "factuur",
  "termijnfactuur",
  "eindfactuur",
  "creditnota",
  "bon",
] as const;

export const HerkenningSchema = z.object({
  is_document: z.boolean(),
  soort: veld(z.enum(SOORTEN)),
  leverancier: veld(z.string()),
  leverancier_kvk: veld(z.string()),
  leverancier_iban: veld(z.string()),
  leverancier_btw_nummer: veld(z.string()),
  documentnummer: veld(z.string()),
  documentdatum: veld(z.string()),
  vervaldatum: veld(z.string()),
  betaaltermijn_dagen: veld(z.number()),
  totaal_incl: veld(z.number()),
  totaal_btw: veld(z.number()),
  btw_per_tarief: z.array(
    z.object({
      tarief: z.number(),
      grondslag: z.number().nullable(),
      btw: z.number().nullable(),
    }),
  ),
  verwijzing: veld(z.string()),
  contract_id: veld(z.string()),
  termijn_id: veld(z.string()),
  regels: z.array(
    z.object({
      omschrijving: z.string(),
      bedrag_incl: z.number().nullable(),
      bedrag_excl: z.number().nullable(),
      btw_tarief: z.number().nullable(),
      categorie_id: z.string().nullable(),
      ruimte_id: z.string().nullable(),
      contract_regel_id: z.string().nullable(),
      zekerheid: z.number(),
      bron: z.string().nullable(),
    }),
  ),
  opmerkingen: z.array(z.string()),
});

export type Herkenning = z.infer<typeof HerkenningSchema>;

/** Een aandachtspunt bij een voorstel (zie docs/ARCHITECTUUR.md § 5). */
export type Aandachtspunt = {
  soort: "ontbreekt" | "klopt-niet" | "onzeker" | "duplicaat";
  /** Veld waar het om gaat, bijv. "documentdatum" of "regel-2". */
  veld: string;
  tekst: string;
  /** Link naar een bestaand document (bij een mogelijk duplicaat). */
  href?: string;
};

// -----------------------------------------------------------------------------
// Wat Claude terugstuurt (structured output)
// -----------------------------------------------------------------------------
// De API staat in een schema hooguit 16 velden toe die null (of iets anders)
// mogen zijn. Daarom: tekst en id's zijn leeg ("") als ze ontbreken, de soort
// is dan "onbekend"; alleen bedragen en getallen mogen null zijn.

const tekst = z.object({
  waarde: z.string(),
  zekerheid: z.number(),
  bron: z.string(),
});
const getal = z.object({
  waarde: z.number().nullable(),
  zekerheid: z.number(),
  bron: z.string(),
});

export const AntwoordSchema = z.object({
  is_document: z.boolean(),
  soort: z.object({
    waarde: z.enum([...SOORTEN, "onbekend"]),
    zekerheid: z.number(),
    bron: z.string(),
  }),
  leverancier: tekst,
  leverancier_kvk: tekst,
  leverancier_iban: tekst,
  leverancier_btw_nummer: tekst,
  documentnummer: tekst,
  documentdatum: tekst,
  vervaldatum: tekst,
  betaaltermijn_dagen: getal,
  totaal_incl: getal,
  totaal_btw: getal,
  btw_per_tarief: z.array(
    z.object({
      tarief: z.number(),
      grondslag: z.number().nullable(),
      btw: z.number().nullable(),
    }),
  ),
  verwijzing: tekst,
  contract_id: tekst,
  termijn_id: tekst,
  regels: z.array(
    z.object({
      omschrijving: z.string(),
      bedrag_incl: z.number().nullable(),
      bedrag_excl: z.number().nullable(),
      btw_tarief: z.number().nullable(),
      categorie_id: z.string(),
      ruimte_id: z.string(),
      contract_regel_id: z.string(),
      zekerheid: z.number(),
      bron: z.string(),
    }),
  ),
  opmerkingen: z.array(z.string()),
});

export type Antwoord = z.infer<typeof AntwoordSchema>;

const leeg = (s: string) => (s.trim() === "" ? null : s.trim());

/** Antwoord van Claude → voorstel zoals de app het gebruikt (lege tekst → null). */
export function naarHerkenning(a: Antwoord): Herkenning {
  const t = (v: z.infer<typeof tekst>) => ({
    waarde: leeg(v.waarde),
    zekerheid: v.zekerheid,
    bron: leeg(v.bron),
  });
  const g = (v: z.infer<typeof getal>) => ({
    waarde: v.waarde,
    zekerheid: v.zekerheid,
    bron: leeg(v.bron),
  });
  return {
    is_document: a.is_document,
    soort: {
      waarde: a.soort.waarde === "onbekend" ? null : a.soort.waarde,
      zekerheid: a.soort.zekerheid,
      bron: leeg(a.soort.bron),
    },
    leverancier: t(a.leverancier),
    leverancier_kvk: t(a.leverancier_kvk),
    leverancier_iban: t(a.leverancier_iban),
    leverancier_btw_nummer: t(a.leverancier_btw_nummer),
    documentnummer: t(a.documentnummer),
    documentdatum: t(a.documentdatum),
    vervaldatum: t(a.vervaldatum),
    betaaltermijn_dagen: g(a.betaaltermijn_dagen),
    totaal_incl: g(a.totaal_incl),
    totaal_btw: g(a.totaal_btw),
    btw_per_tarief: a.btw_per_tarief,
    verwijzing: t(a.verwijzing),
    contract_id: t(a.contract_id),
    termijn_id: t(a.termijn_id),
    regels: a.regels.map((r) => ({
      omschrijving: r.omschrijving.trim(),
      bedrag_incl: r.bedrag_incl,
      bedrag_excl: r.bedrag_excl,
      btw_tarief: r.btw_tarief,
      categorie_id: leeg(r.categorie_id),
      ruimte_id: leeg(r.ruimte_id),
      contract_regel_id: leeg(r.contract_regel_id),
      zekerheid: r.zekerheid,
      bron: leeg(r.bron),
    })),
    opmerkingen: a.opmerkingen.map((o) => o.trim()).filter(Boolean),
  };
}
