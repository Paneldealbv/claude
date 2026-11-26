"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { knopKlassen } from "@/components/ui/knop";
import { BTW_TARIEVEN } from "@/lib/btw";
import { cn } from "@/lib/cn";
import { formatBedragInvoer, formatEuro, parseEuro } from "@/lib/format";

export type CategorieOptie = { id: string; label: string };

export type RegelInvoer = {
  omschrijving: string;
  categorieId: string | null;
  /** Centen incl. BTW. */
  bedrag: number;
  btw: number;
};

type Rij = {
  sleutel: number;
  omschrijving: string;
  categorieId: string;
  bedragTekst: string;
  btw: number;
};

const invoerKlassen =
  "border-border-strong bg-surface placeholder:text-subtle block w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none focus:border-accent focus:ring-accent/15 focus:ring-4";

/**
 * Regels van een offerte of contract: omschrijving, categorie, bedrag incl.
 * BTW en BTW-tarief. Het formulier krijgt de regels als JSON in één veld.
 */
export function RegelsEditor({
  categorieen,
  standaard = [],
  categorieVerplicht = false,
  naam = "regels",
}: {
  categorieen: CategorieOptie[];
  standaard?: RegelInvoer[];
  categorieVerplicht?: boolean;
  naam?: string;
}) {
  const basisId = useId();
  const [volgnummer, setVolgnummer] = useState(standaard.length + 1);
  const [rijen, setRijen] = useState<Rij[]>(
    standaard.length
      ? standaard.map((r, i) => ({
          sleutel: i,
          omschrijving: r.omschrijving,
          categorieId: r.categorieId ?? "",
          bedragTekst: formatBedragInvoer(r.bedrag),
          btw: r.btw,
        }))
      : [
          {
            sleutel: 0,
            omschrijving: "",
            categorieId: "",
            bedragTekst: "",
            btw: 2100,
          },
        ],
  );

  const wijzig = (sleutel: number, deel: Partial<Rij>) =>
    setRijen((huidig) =>
      huidig.map((r) => (r.sleutel === sleutel ? { ...r, ...deel } : r)),
    );

  const totaal = rijen.reduce((a, r) => a + (parseEuro(r.bedragTekst) ?? 0), 0);
  const waarde = JSON.stringify(
    rijen.map((r) => ({
      omschrijving: r.omschrijving.trim(),
      categorieId: r.categorieId || null,
      bedrag: parseEuro(r.bedragTekst),
      btw: r.btw,
    })),
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name={naam} value={waarde} />
      <div className="text-muted hidden grid-cols-[1.4fr_1.2fr_9rem_5.5rem_2.5rem] gap-3 px-1 text-xs font-medium md:grid">
        <span>Omschrijving</span>
        <span>Categorie{categorieVerplicht ? "" : " (optioneel)"}</span>
        <span className="text-right">Bedrag incl. BTW</span>
        <span>BTW</span>
        <span />
      </div>
      <ul className="space-y-3 md:space-y-2">
        {rijen.map((r, i) => {
          const id = `${basisId}-${r.sleutel}`;
          const bedrag = parseEuro(r.bedragTekst);
          const bedragFout = r.bedragTekst.trim() !== "" && bedrag === null;
          return (
            <li
              key={r.sleutel}
              className="border-border grid grid-cols-2 gap-2 rounded-xl border p-3 md:grid-cols-[1.4fr_1.2fr_9rem_5.5rem_2.5rem] md:items-start md:gap-3 md:border-0 md:p-0"
            >
              <div className="col-span-2 md:col-span-1">
                <label
                  htmlFor={`${id}-oms`}
                  className="mb-1 block text-xs font-medium md:sr-only"
                >
                  Omschrijving regel {i + 1}
                </label>
                <input
                  id={`${id}-oms`}
                  className={invoerKlassen}
                  placeholder="Bijv. keukenblok met apparatuur"
                  value={r.omschrijving}
                  maxLength={300}
                  onChange={(e) =>
                    wijzig(r.sleutel, { omschrijving: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label
                  htmlFor={`${id}-cat`}
                  className="mb-1 block text-xs font-medium md:sr-only"
                >
                  Categorie regel {i + 1}
                </label>
                <select
                  id={`${id}-cat`}
                  className={invoerKlassen}
                  value={r.categorieId}
                  onChange={(e) =>
                    wijzig(r.sleutel, { categorieId: e.target.value })
                  }
                >
                  <option value="">
                    {categorieVerplicht
                      ? "Kies een categorie"
                      : "Geen categorie"}
                  </option>
                  {categorieen.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor={`${id}-bedrag`}
                  className="mb-1 block text-xs font-medium md:sr-only"
                >
                  Bedrag regel {i + 1}
                </label>
                <div className="relative">
                  <span className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
                    €
                  </span>
                  <input
                    id={`${id}-bedrag`}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    className={cn(
                      invoerKlassen,
                      "pl-7 text-right tabular-nums",
                      bedragFout && "border-critical",
                    )}
                    aria-invalid={bedragFout || undefined}
                    value={r.bedragTekst}
                    onChange={(e) =>
                      wijzig(r.sleutel, { bedragTekst: e.target.value })
                    }
                    onBlur={() => {
                      if (bedrag !== null)
                        wijzig(r.sleutel, {
                          bedragTekst: formatBedragInvoer(bedrag),
                        });
                    }}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor={`${id}-btw`}
                  className="mb-1 block text-xs font-medium md:sr-only"
                >
                  BTW regel {i + 1}
                </label>
                <select
                  id={`${id}-btw`}
                  className={invoerKlassen}
                  value={r.btw}
                  onChange={(e) =>
                    wijzig(r.sleutel, { btw: Number(e.target.value) })
                  }
                >
                  {BTW_TARIEVEN.map((t) => (
                    <option key={t.bp} value={t.bp}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 flex justify-end md:col-span-1">
                <button
                  type="button"
                  disabled={rijen.length === 1}
                  onClick={() =>
                    setRijen((huidig) =>
                      huidig.filter((x) => x.sleutel !== r.sleutel),
                    )
                  }
                  className={knopKlassen(
                    "stil",
                    "hover:text-critical px-2.5 py-2.5",
                  )}
                  title="Regel verwijderen"
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Verwijder regel {i + 1}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setRijen((huidig) => [
              ...huidig,
              {
                sleutel: volgnummer,
                omschrijving: "",
                categorieId: "",
                bedragTekst: "",
                btw: 2100,
              },
            ]);
            setVolgnummer((n) => n + 1);
          }}
          className={knopKlassen("secundair", "px-3 py-2")}
        >
          <Plus className="size-4" />
          Regel toevoegen
        </button>
        <p className="text-sm">
          <span className="text-muted">Totaal incl. BTW </span>
          <span className="font-semibold tabular-nums">
            {formatEuro(totaal)}
          </span>
        </p>
      </div>
    </div>
  );
}
