import type { Cent, ProjectInvoer } from "./types";

const WAT_ALS = "__wat_als__";

/**
 * De projectinvoer alsof er een extra (actief) contract met deze regels is
 * getekend. Gebruikt om vóór het accepteren van een offerte te laten zien
 * wat dat met de prognose doet. Regels zonder categorie tellen niet mee
 * (een offerte zonder categorieën kan ook niet worden geaccepteerd).
 */
export function metExtraContract(
  invoer: ProjectInvoer,
  regels: {
    categorieId: string | null;
    omschrijving: string;
    bedrag: Cent;
  }[],
  leverancierId: string | null = null,
): ProjectInvoer {
  return {
    ...invoer,
    contracten: [
      ...invoer.contracten,
      { id: WAT_ALS, titel: "", leverancierId, status: "actief" },
    ],
    contractRegels: [
      ...invoer.contractRegels,
      ...regels.flatMap((r, i) =>
        r.categorieId
          ? [
              {
                id: `${WAT_ALS}-${i}`,
                contractId: WAT_ALS,
                categorieId: r.categorieId,
                omschrijving: r.omschrijving,
                bedrag: r.bedrag,
              },
            ]
          : [],
      ),
    ],
  };
}
