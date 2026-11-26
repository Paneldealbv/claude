/** Weergave van statussen (tekst + kleur van het label). */
type Soort = "info" | "positief" | "neutraal" | "kritiek" | "waarschuwing";

export const STATUS_OFFERTE = {
  ontvangen: { tekst: "Ontvangen", soort: "info" },
  geaccepteerd: { tekst: "Geaccepteerd", soort: "positief" },
  afgewezen: { tekst: "Afgewezen", soort: "neutraal" },
  verlopen: { tekst: "Verlopen", soort: "neutraal" },
} as const satisfies Record<string, { tekst: string; soort: Soort }>;

export const STATUS_CONTRACT = {
  actief: { tekst: "Actief", soort: "info" },
  afgerond: { tekst: "Afgerond", soort: "positief" },
  geannuleerd: { tekst: "Geannuleerd", soort: "neutraal" },
} as const satisfies Record<string, { tekst: string; soort: Soort }>;

export const STATUS_WIJZIGING = {
  voorgesteld: { tekst: "Voorgesteld", soort: "waarschuwing" },
  akkoord: { tekst: "Akkoord", soort: "positief" },
  afgewezen: { tekst: "Afgewezen", soort: "neutraal" },
} as const satisfies Record<string, { tekst: string; soort: Soort }>;

export const STATUS_TERMIJN = {
  open: { tekst: "Nog te factureren", soort: "neutraal" },
  deels: { tekst: "Deels gefactureerd", soort: "waarschuwing" },
  gefactureerd: { tekst: "Gefactureerd", soort: "positief" },
} as const satisfies Record<string, { tekst: string; soort: Soort }>;

export const DOCUMENT_TYPE = {
  factuur: { tekst: "Factuur", meervoud: "Facturen" },
  termijnfactuur: { tekst: "Termijnfactuur", meervoud: "Termijnfacturen" },
  eindfactuur: { tekst: "Eindfactuur", meervoud: "Eindfacturen" },
  creditnota: { tekst: "Creditnota", meervoud: "Creditnota's" },
  bon: { tekst: "Bon", meervoud: "Bonnen" },
} as const;

export type DocumentSoort = keyof typeof DOCUMENT_TYPE;

export const STATUS_DOCUMENT = {
  concept: { tekst: "Concept", soort: "neutraal" },
  te_controleren: { tekst: "Te controleren", soort: "waarschuwing" },
  geboekt: { tekst: "Geboekt", soort: "positief" },
  vervallen: { tekst: "Vervallen", soort: "neutraal" },
} as const satisfies Record<string, { tekst: string; soort: Soort }>;

export const BETAALSTATUS = {
  open: { tekst: "Open", soort: "info" },
  deels: { tekst: "Deels betaald", soort: "waarschuwing" },
  betaald: { tekst: "Betaald", soort: "positief" },
  te_laat: { tekst: "Te laat", soort: "kritiek" },
} as const satisfies Record<string, { tekst: string; soort: Soort }>;
