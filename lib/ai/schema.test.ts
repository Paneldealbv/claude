import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";
import {
  AntwoordSchema,
  HerkenningSchema,
  naarHerkenning,
  type Antwoord,
} from "./schema";

/** Telt velden met een union-type (anyOf of een lijst van typen), zoals de API. */
function telUnions(knoop: unknown): number {
  if (Array.isArray(knoop)) return knoop.reduce((n, k) => n + telUnions(k), 0);
  if (!knoop || typeof knoop !== "object") return 0;
  const o = knoop as Record<string, unknown>;
  const eigen = Array.isArray(o.type) || Array.isArray(o.anyOf) ? 1 : 0;
  return eigen + Object.values(o).reduce<number>((n, k) => n + telUnions(k), 0);
}

const tekst = (waarde = "", zekerheid = 0.9) => ({
  waarde,
  zekerheid,
  bron: "",
});

describe("AntwoordSchema", () => {
  it("blijft binnen de grens van de API (hooguit 16 velden met een union)", () => {
    const { schema } = betaZodOutputFormat(AntwoordSchema) as unknown as {
      schema: unknown;
    };
    expect(telUnions(schema)).toBeLessThanOrEqual(16);
    // Ijkpunt: voor het interne schema meldde de API 37 zulke velden.
    const intern = betaZodOutputFormat(HerkenningSchema) as unknown as {
      schema: unknown;
    };
    expect(telUnions(intern.schema)).toBe(37);
  });

  it("zet lege tekst en 'onbekend' om naar null", () => {
    const antwoord: Antwoord = {
      is_document: true,
      soort: { waarde: "onbekend", zekerheid: 0.4, bron: "" },
      leverancier: tekst(" Bouwmarkt Zuid "),
      leverancier_kvk: tekst(),
      leverancier_iban: tekst(),
      leverancier_btw_nummer: tekst(),
      documentnummer: tekst("BZ-1"),
      documentdatum: tekst("2026-11-20"),
      vervaldatum: tekst(""),
      betaaltermijn_dagen: { waarde: null, zekerheid: 0.2, bron: "" },
      totaal_incl: { waarde: 12.5, zekerheid: 0.95, bron: "Totaal 12,50" },
      totaal_btw: { waarde: null, zekerheid: 0.3, bron: "" },
      btw_per_tarief: [],
      verwijzing: tekst(),
      contract_id: tekst(),
      termijn_id: tekst(),
      regels: [
        {
          omschrijving: " Kit ",
          bedrag_incl: 12.5,
          bedrag_excl: null,
          btw_tarief: 21,
          categorie_id: "",
          ruimte_id: "",
          contract_regel_id: "",
          zekerheid: 0.9,
          bron: "",
        },
      ],
      opmerkingen: ["", " Handgeschreven. "],
    };
    const h = naarHerkenning(antwoord);
    expect(h.soort.waarde).toBeNull();
    expect(h.leverancier).toEqual({
      waarde: "Bouwmarkt Zuid",
      zekerheid: 0.9,
      bron: null,
    });
    expect(h.vervaldatum.waarde).toBeNull();
    expect(h.totaal_incl).toEqual({
      waarde: 12.5,
      zekerheid: 0.95,
      bron: "Totaal 12,50",
    });
    expect(h.regels[0]).toMatchObject({
      omschrijving: "Kit",
      categorie_id: null,
      ruimte_id: null,
      contract_regel_id: null,
      bron: null,
    });
    expect(h.opmerkingen).toEqual(["Handgeschreven."]);
  });
});
