import { z } from "zod";

/*
 * Wat Claude terugstuurt bij het uitlezen van een factuur of bon (structured
 * output: het antwoord voldoet altijd aan dit schema). Per veld: de waarde,
 * een zekerheid (0–1) en de tekst op het document waarop het is gebaseerd.
 * Bedragen in euro's inclusief BTW (getal met punt als decimaalteken),
 * datums als JJJJ-MM-DD. Id's komen uit de lijsten die we meesturen.
 */

const veld = <T extends z.ZodType>(waarde: T) =>
  z.object({
    waarde: waarde.nullable(),
    zekerheid: z.number(),
    bron: z.string().nullable(),
  });

export const HerkenningSchema = z.object({
  is_document: z.boolean(),
  soort: veld(
    z.enum(["factuur", "termijnfactuur", "eindfactuur", "creditnota", "bon"]),
  ),
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
