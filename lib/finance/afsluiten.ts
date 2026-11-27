/**
 * Controle vóór het afsluiten van een categorie (docs/ARCHITECTUUR.md § 3.4).
 *
 * Zolang een categorie open is, is de prognose minimaal het budget. Bij
 * afsluiten wordt de prognose gelijk aan wat werkelijk is vastgelegd; een
 * meevaller wordt dan zichtbaar. Eerst waarschuwen we voor alles wat nog
 * openstaat. Een afgesloten hoofdcategorie sluit ook haar subcategorieën.
 */
import { bereken, type BerekenOpties } from "./bereken";
import type { Cent, ProjectInvoer } from "./types";
import { formatEuro } from "../format";

export type AfsluitWaarschuwing = {
  code:
    | "openstaande_facturen"
    | "openstaande_verplichtingen"
    | "open_termijnen"
    | "voorgesteld_meerwerk"
    | "te_controleren";
  tekst: string;
  aantal: number;
  bedrag: Cent;
};

export type AfsluitControle = {
  categorieId: string;
  /** Geen waarschuwingen: direct afsluiten zonder extra bevestiging. */
  kanDirectAfsluiten: boolean;
  waarschuwingen: AfsluitWaarschuwing[];
  budget: Cent;
  prognoseNu: Cent;
  prognoseNaAfsluiten: Cent;
  /** Na afsluiten: vastgelegd − budget (negatief = meevaller). */
  afwijkingNaAfsluiten: Cent;
};

const euro = (c: Cent) => formatEuro(c, { centen: false });
const meervoud = (n: number, een: string, meer: string) =>
  n === 1 ? een : meer;

export function controleerAfsluiten(
  invoer: ProjectInvoer,
  categorieId: string,
  opties: BerekenOpties,
): AfsluitControle {
  const { resultaat, intern } = bereken(invoer, opties);
  const categorie = resultaat.categorieen.find((c) => c.id === categorieId);
  if (!categorie) throw new RangeError(`Onbekende categorie: ${categorieId}`);

  const boom = intern.subboom(categorieId);
  const inBoom = (id: string | null) => id !== null && boom.has(id);
  const waarschuwingen: AfsluitWaarschuwing[] = [];

  // 1. Geboekte documenten met een onbetaald deel in deze categorie.
  const openPerDocument = new Map<string, Cent>();
  for (const d of intern.delen) {
    if (d.geboekt && inBoom(d.categorieId)) {
      openPerDocument.set(
        d.documentId,
        (openPerDocument.get(d.documentId) ?? 0) + d.bedrag - d.betaald,
      );
    }
  }
  const openDocs = [...openPerDocument.values()].filter((b) => b !== 0);
  if (openDocs.length) {
    const bedrag = openDocs.reduce((a, b) => a + b, 0);
    waarschuwingen.push({
      code: "openstaande_facturen",
      aantal: openDocs.length,
      bedrag,
      tekst: `${openDocs.length} ${meervoud(openDocs.length, "factuur is", "facturen zijn")} nog niet volledig betaald (${euro(bedrag)}).`,
    });
  }

  // 2. Actieve contracten waarop nog gefactureerd gaat worden.
  const regelsInBoom = invoer.contractRegels.filter((r) =>
    inBoom(r.categorieId),
  );
  const nogTeFactureren = regelsInBoom.filter(
    (r) => (intern.nogTeFactureren.get(r.id) ?? 0) > 0,
  );
  if (nogTeFactureren.length) {
    const bedrag = nogTeFactureren.reduce(
      (a, r) => a + (intern.nogTeFactureren.get(r.id) ?? 0),
      0,
    );
    const contracten = new Set(nogTeFactureren.map((r) => r.contractId)).size;
    waarschuwingen.push({
      code: "openstaande_verplichtingen",
      aantal: contracten,
      bedrag,
      tekst: `Op ${contracten} ${meervoud(contracten, "contract", "contracten")} moet nog ${euro(bedrag)} gefactureerd worden.`,
    });
  }

  // 3. Termijnen van betrokken actieve contracten die nog niet (volledig) gefactureerd zijn.
  const contractIds = new Set(regelsInBoom.map((r) => r.contractId));
  const openTermijnen = resultaat.contracten
    .filter((c) => contractIds.has(c.id) && c.status === "actief")
    .flatMap((c) => c.termijnen.filter((t) => t.status !== "gefactureerd"));
  if (openTermijnen.length) {
    const bedrag = openTermijnen.reduce(
      (a, t) => a + t.verwachtBedrag - t.gefactureerd,
      0,
    );
    waarschuwingen.push({
      code: "open_termijnen",
      aantal: openTermijnen.length,
      bedrag,
      tekst: `${openTermijnen.length} ${meervoud(openTermijnen.length, "termijn is", "termijnen zijn")} nog niet gefactureerd.`,
    });
  }

  // 4. Meer-/minderwerk dat nog op een besluit wacht.
  const regelIds = new Set(regelsInBoom.map((r) => r.id));
  const voorgesteld = invoer.wijzigingen.filter(
    (w) => w.status === "voorgesteld" && regelIds.has(w.contractRegelId),
  );
  if (voorgesteld.length) {
    const bedrag = voorgesteld.reduce((a, w) => a + w.bedrag, 0);
    waarschuwingen.push({
      code: "voorgesteld_meerwerk",
      aantal: voorgesteld.length,
      bedrag,
      tekst: `${voorgesteld.length}× meer-/minderwerk wacht nog op goedkeuring (${euro(bedrag)}).`,
    });
  }

  // 5. Documenten die nog gecontroleerd moeten worden.
  const teControleren = new Map<string, Cent>();
  for (const d of intern.delen) {
    if (d.inControle && inBoom(d.categorieId)) {
      teControleren.set(
        d.documentId,
        (teControleren.get(d.documentId) ?? 0) + d.bedrag,
      );
    }
  }
  if (teControleren.size) {
    const bedrag = [...teControleren.values()].reduce((a, b) => a + b, 0);
    waarschuwingen.push({
      code: "te_controleren",
      aantal: teControleren.size,
      bedrag,
      tekst: `${teControleren.size} ${meervoud(teControleren.size, "document moet", "documenten moeten")} nog gecontroleerd worden (${euro(bedrag)}).`,
    });
  }

  const { budget, prognose, vastgelegd } = categorie.cijfers;
  return {
    categorieId,
    kanDirectAfsluiten: waarschuwingen.length === 0,
    waarschuwingen,
    budget,
    prognoseNu: prognose,
    prognoseNaAfsluiten: vastgelegd,
    afwijkingNaAfsluiten: vastgelegd - budget,
  };
}
