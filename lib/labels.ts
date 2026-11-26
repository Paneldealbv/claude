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
