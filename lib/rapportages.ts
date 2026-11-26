import "server-only";
import { cache } from "react";
import { documentOverzicht } from "@/lib/data/documenten";
import { laadLeveranciers } from "@/lib/data/offertes";
import { laadProjectResultaat } from "@/lib/data/project";
import type { Cijfers } from "@/lib/finance";
import { DOCUMENT_TYPE, STATUS_DOCUMENT } from "@/lib/labels";

/*
 * Rapportages: één model per rapport, gebruikt door de pagina, de CSV- en de
 * Excel-export. Zo zijn de cijfers overal precies gelijk. Bedragen in centen
 * incl. BTW; datums als JJJJ-MM-DD.
 */

export type RapportSleutel =
  "categorie" | "ruimte" | "leverancier" | "betalingen" | "documenten";

export type Kolom = {
  label: string;
  soort: "tekst" | "bedrag" | "datum" | "getal";
  /** Toon een balk naar verhouding van de grootste waarde (alleen scherm). */
  balk?: boolean;
  /** Bedrag als verschil tonen: "+ € 4.580" / "− € 1.220". */
  verschil?: boolean;
};

export type RapportRij = {
  cellen: (string | number | null)[];
  /** 0 = hoofdregel, 1 = onderliggende regel (ingesprongen). */
  niveau?: 0 | 1;
  totaal?: boolean;
  href?: string;
};

export type Rapport = {
  sleutel: RapportSleutel;
  titel: string;
  /** Naam van het tabblad in Excel (max. 31 tekens). */
  tabblad: string;
  omschrijving: string;
  kolommen: Kolom[];
  rijen: RapportRij[];
  /** Eerste twee kolommen vormen samen een boom (hoofd- en subcategorie). */
  boom?: boolean;
};

export const RAPPORTEN: { sleutel: RapportSleutel; label: string }[] = [
  { sleutel: "categorie", label: "Per categorie" },
  { sleutel: "ruimte", label: "Per ruimte" },
  { sleutel: "leverancier", label: "Per leverancier" },
  { sleutel: "betalingen", label: "Betalingen" },
  { sleutel: "documenten", label: "Documenten" },
];

const CIJFERKOLOMMEN: Kolom[] = [
  { label: "Budget", soort: "bedrag" },
  { label: "Gecontracteerd", soort: "bedrag" },
  { label: "Gefactureerd", soort: "bedrag" },
  { label: "Betaald", soort: "bedrag" },
  { label: "Openstaand", soort: "bedrag" },
  { label: "Prognose", soort: "bedrag" },
  { label: "Afwijking", soort: "bedrag", verschil: true },
];

const cijferCellen = (c: Cijfers) => [
  c.budget,
  c.gecontracteerd,
  c.gefactureerd,
  c.betaald,
  c.openstaand,
  c.prognose,
  c.afwijking,
];

export const laadRapporten = cache(
  async (projectId: string): Promise<Record<RapportSleutel, Rapport>> => {
    const [{ invoer, resultaat }, documenten, leveranciers] = await Promise.all(
      [
        laadProjectResultaat(projectId),
        documentOverzicht(projectId),
        laadLeveranciers(projectId),
      ],
    );

    // --- Per categorie (boom) ---------------------------------------------
    const volgorde = new Map(invoer.categorieen.map((c) => [c.id, c.volgorde]));
    const sorteer = <T extends { id: string; naam: string }>(lijst: T[]) =>
      [...lijst].sort(
        (a, b) =>
          (volgorde.get(a.id) ?? 0) - (volgorde.get(b.id) ?? 0) ||
          a.naam.localeCompare(b.naam, "nl"),
      );
    const perOuder = (ouder: string | null) =>
      sorteer(resultaat.categorieen.filter((c) => c.parentId === ouder));
    const categorieRijen: RapportRij[] = [];
    for (const hoofd of perOuder(null)) {
      categorieRijen.push({
        cellen: [
          hoofd.naam,
          "",
          ...cijferCellen(hoofd.cijfers),
          hoofd.afgesloten ? "Afgesloten" : "Open",
        ],
        niveau: 0,
        href: `/budget/${hoofd.id}`,
      });
      // Dieper dan twee niveaus komt zelden voor: als pad onder de hoofdcategorie.
      const onder = (ouder: string, pad: string[]): void => {
        for (const sub of perOuder(ouder)) {
          const naam = [...pad, sub.naam].join(" › ");
          categorieRijen.push({
            cellen: [
              hoofd.naam,
              naam,
              ...cijferCellen(sub.cijfers),
              sub.afgesloten ? "Afgesloten" : "Open",
            ],
            niveau: 1,
            href: `/budget/${sub.id}`,
          });
          onder(sub.id, [...pad, sub.naam]);
        }
      };
      onder(hoofd.id, []);
    }
    categorieRijen.push({
      cellen: ["Totaal", "", ...cijferCellen(resultaat.cijfers), ""],
      totaal: true,
    });

    // --- Per ruimte ---------------------------------------------------------
    const ruimteSom = (
      veld: "gecontracteerd" | "gefactureerd" | "betaald" | "vastgelegd",
    ) => resultaat.ruimtes.reduce((a, r) => a + r[veld], 0);
    const ruimteRijen: RapportRij[] = [
      ...resultaat.ruimtes.map((r) => ({
        cellen: [
          r.naam,
          r.gecontracteerd,
          r.gefactureerd,
          r.betaald,
          r.vastgelegd,
        ],
      })),
      {
        cellen: [
          "Totaal",
          ruimteSom("gecontracteerd"),
          ruimteSom("gefactureerd"),
          ruimteSom("betaald"),
          ruimteSom("vastgelegd"),
        ],
        totaal: true,
      },
    ];

    // --- Per leverancier ----------------------------------------------------
    const geboekt = documenten.filter((d) => d.status === "geboekt");
    const contractCijfers = new Map(resultaat.contracten.map((c) => [c.id, c]));
    const leverancierRij = (
      id: string | null,
      naam: string,
    ): RapportRij | null => {
      const contracten = invoer.contracten.filter(
        (c) => c.leverancierId === id,
      );
      const docs = geboekt.filter((d) => d.leverancierId === id);
      if (!contracten.length && !docs.length) return null;
      return {
        cellen: [
          naam,
          contracten.length,
          contracten.reduce(
            (a, c) => a + (contractCijfers.get(c.id)?.gecontracteerd ?? 0),
            0,
          ),
          docs.reduce((a, d) => a + d.totaal, 0),
          docs.reduce((a, d) => a + d.betaald, 0),
          docs.reduce((a, d) => a + d.openstaand, 0),
        ],
        href: id ? `/leveranciers/${id}` : undefined,
      };
    };
    const leverancierRijen = [
      ...[...leveranciers]
        .sort((a, b) => a.naam.localeCompare(b.naam, "nl"))
        .map((l) => leverancierRij(l.id, l.naam)),
      leverancierRij(null, "Zonder leverancier"),
    ].filter((r): r is RapportRij => r !== null);
    const kolomSom = (rijen: RapportRij[], i: number) =>
      rijen.reduce((a, r) => a + Number(r.cellen[i] ?? 0), 0);
    leverancierRijen.push({
      cellen: [
        "Totaal",
        kolomSom(leverancierRijen, 1),
        kolomSom(leverancierRijen, 2),
        kolomSom(leverancierRijen, 3),
        kolomSom(leverancierRijen, 4),
        kolomSom(leverancierRijen, 5),
      ],
      totaal: true,
    });

    // --- Betalingen ---------------------------------------------------------
    const docPerId = new Map(documenten.map((d) => [d.id, d]));
    const bronNaam = new Map(invoer.bronnen.map((b) => [b.id, b.naam]));
    const betalingRijen: RapportRij[] = [...invoer.betalingen]
      .filter((b) => docPerId.get(b.documentId)?.status === "geboekt")
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .map((b) => {
        const d = docPerId.get(b.documentId);
        return {
          cellen: [
            b.datum,
            d?.titel ?? "",
            d
              ? `${DOCUMENT_TYPE[d.type].tekst}${d.nummer ? ` ${d.nummer}` : ""}`
              : "",
            b.bronId ? (bronNaam.get(b.bronId) ?? "") : "",
            b.bedrag,
          ],
          href: `/documenten/${b.documentId}`,
        };
      });
    betalingRijen.push({
      cellen: ["Totaal", "", "", "", kolomSom(betalingRijen, 4)],
      totaal: true,
    });

    // --- Documenten ---------------------------------------------------------
    const documentRijen: RapportRij[] = documenten.map((d) => ({
      cellen: [
        d.datum,
        DOCUMENT_TYPE[d.type].tekst,
        d.nummer ?? "",
        d.titel,
        d.contractTitel ?? "",
        STATUS_DOCUMENT[d.status].tekst,
        d.totaal,
        d.status === "geboekt" ? d.betaald : null,
        d.status === "geboekt" ? d.openstaand : null,
        d.vervalDatum,
      ],
      href: `/documenten/${d.id}`,
    }));
    documentRijen.push({
      cellen: [
        "Totaal geboekt",
        "",
        "",
        "",
        "",
        "",
        geboekt.reduce((a, d) => a + d.totaal, 0),
        geboekt.reduce((a, d) => a + d.betaald, 0),
        geboekt.reduce((a, d) => a + d.openstaand, 0),
        null,
      ],
      totaal: true,
    });

    return {
      categorie: {
        sleutel: "categorie",
        titel: "Per categorie",
        tabblad: "Categorieën",
        omschrijving:
          "Budget, contracten, facturen, betalingen en prognose per categorie. Hoofdcategorieën tellen hun subcategorieën op.",
        kolommen: [
          { label: "Hoofdcategorie", soort: "tekst" },
          { label: "Subcategorie", soort: "tekst" },
          ...CIJFERKOLOMMEN,
          { label: "Status", soort: "tekst" },
        ],
        rijen: categorieRijen,
        boom: true,
      },
      ruimte: {
        sleutel: "ruimte",
        titel: "Per ruimte",
        tabblad: "Ruimtes",
        omschrijving:
          "Kosten per ruimte, volgens de ruimteverdeling van contract- en kostenregels. Wat niet aan een ruimte is toegewezen, staat apart, zodat het totaal klopt.",
        kolommen: [
          { label: "Ruimte", soort: "tekst" },
          { label: "Gecontracteerd", soort: "bedrag" },
          { label: "Gefactureerd", soort: "bedrag" },
          { label: "Betaald", soort: "bedrag" },
          { label: "Vastgelegd", soort: "bedrag", balk: true },
        ],
        rijen: ruimteRijen,
      },
      leverancier: {
        sleutel: "leverancier",
        titel: "Per leverancier",
        tabblad: "Leveranciers",
        omschrijving:
          "Contracten en geboekte facturen en bonnen per leverancier, met wat er al betaald is en nog openstaat.",
        kolommen: [
          { label: "Leverancier", soort: "tekst" },
          { label: "Contracten", soort: "getal" },
          { label: "Gecontracteerd", soort: "bedrag" },
          { label: "Gefactureerd", soort: "bedrag" },
          { label: "Betaald", soort: "bedrag" },
          { label: "Openstaand", soort: "bedrag" },
        ],
        rijen: leverancierRijen,
      },
      betalingen: {
        sleutel: "betalingen",
        titel: "Betalingen",
        tabblad: "Betalingen",
        omschrijving:
          "Alle betalingen op geboekte documenten, op datum. Handig om naast je bankafschriften te leggen.",
        kolommen: [
          { label: "Datum", soort: "datum" },
          { label: "Leverancier", soort: "tekst" },
          { label: "Document", soort: "tekst" },
          { label: "Betaald uit", soort: "tekst" },
          { label: "Bedrag", soort: "bedrag" },
        ],
        rijen: betalingRijen,
      },
      documenten: {
        sleutel: "documenten",
        titel: "Documenten",
        tabblad: "Documenten",
        omschrijving:
          "Alle facturen, termijnfacturen, eindfacturen, creditnota's en bonnen met hun status.",
        kolommen: [
          { label: "Datum", soort: "datum" },
          { label: "Soort", soort: "tekst" },
          { label: "Nummer", soort: "tekst" },
          { label: "Leverancier", soort: "tekst" },
          { label: "Contract", soort: "tekst" },
          { label: "Status", soort: "tekst" },
          { label: "Totaal", soort: "bedrag" },
          { label: "Betaald", soort: "bedrag" },
          { label: "Openstaand", soort: "bedrag" },
          { label: "Uiterlijk betalen", soort: "datum" },
        ],
        rijen: documentRijen,
      },
    };
  },
);
