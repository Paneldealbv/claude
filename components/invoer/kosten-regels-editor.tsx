"use client";

import { DoorOpen, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { knopKlassen } from "@/components/ui/knop";
import { BTW_TARIEVEN } from "@/lib/btw";
import { cn } from "@/lib/cn";
import { formatBedragInvoer, formatEuro, parseEuro } from "@/lib/format";

/** Waar een kostenregel bij hoort: k:<categorie>, c:<contract>, r:<contractregel>. */
export type DoelGroep = {
  label: string;
  opties: { waarde: string; label: string }[];
};

export type KostenRegelInvoer = {
  omschrijving: string;
  doel: string;
  /** Centen incl. BTW (zoals ingevuld; bij een creditnota positief). */
  bedrag: number | null;
  btw: number;
  ruimtes: string[];
};

type Rij = {
  sleutel: number;
  omschrijving: string;
  doel: string;
  bedragTekst: string;
  btw: number;
  ruimtes: string[];
  ruimtesOpen: boolean;
};

const invoerKlassen =
  "border-border-strong bg-surface placeholder:text-subtle block w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none focus:border-accent focus:ring-accent/15 focus:ring-4";

function nieuweRij(sleutel: number, doel: string): Rij {
  return {
    sleutel,
    omschrijving: "",
    doel,
    bedragTekst: "",
    btw: 2100,
    ruimtes: [],
    ruimtesOpen: false,
  };
}

/**
 * Regels van een factuur of bon. Eén bon kan over meerdere regels worden
 * verdeeld (bijv. tegels voor de badkamer en verf voor de woonkamer); het
 * originele document wordt één keer bewaard. Het formulier krijgt de regels
 * als JSON in één veld.
 */
export function KostenRegelsEditor({
  doelen,
  ruimtes,
  standaard = [],
  standaardDoel = "",
  totaalOpDocument = null,
  naam = "regels",
}: {
  doelen: DoelGroep[];
  ruimtes: { id: string; naam: string }[];
  standaard?: KostenRegelInvoer[];
  /** Voor nieuwe regels, bijv. het contract dat bovenaan is gekozen. */
  standaardDoel?: string;
  /** Om live te tonen of de regels kloppen met het document. */
  totaalOpDocument?: number | null;
  naam?: string;
}) {
  const basisId = useId();
  const [volgnummer, setVolgnummer] = useState(standaard.length + 1);
  const [rijen, setRijen] = useState<Rij[]>(
    standaard.length
      ? standaard.map((r, i) => ({
          sleutel: i,
          omschrijving: r.omschrijving,
          doel: r.doel,
          bedragTekst: r.bedrag === null ? "" : formatBedragInvoer(r.bedrag),
          btw: r.btw,
          ruimtes: r.ruimtes,
          ruimtesOpen: false,
        }))
      : [nieuweRij(0, standaardDoel)],
  );

  // Kiest de gebruiker bovenaan (een ander) contract, dan krijgen regels die
  // nog nergens bij horen (of bij het vorige contract) het nieuwe contract.
  const [vorigDoel, setVorigDoel] = useState(standaardDoel);
  if (standaardDoel !== vorigDoel) {
    setVorigDoel(standaardDoel);
    setRijen((huidig) =>
      huidig.map((r) =>
        r.doel === "" || r.doel === vorigDoel
          ? { ...r, doel: standaardDoel }
          : r,
      ),
    );
  }

  const wijzig = (sleutel: number, deel: Partial<Rij>) =>
    setRijen((huidig) =>
      huidig.map((r) => (r.sleutel === sleutel ? { ...r, ...deel } : r)),
    );

  const ruimteNaam = new Map(ruimtes.map((r) => [r.id, r.naam]));
  const totaal = rijen.reduce((a, r) => a + (parseEuro(r.bedragTekst) ?? 0), 0);
  const verschil =
    totaalOpDocument !== null && rijen.some((r) => r.bedragTekst.trim())
      ? totaal - totaalOpDocument
      : 0;
  const waarde = JSON.stringify(
    rijen.map((r) => ({
      omschrijving: r.omschrijving.trim(),
      doel: r.doel,
      bedrag: parseEuro(r.bedragTekst),
      btw: r.btw,
      ruimtes: r.ruimtes,
    })),
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name={naam} value={waarde} />
      <div className="text-muted hidden grid-cols-[1.2fr_1.5fr_8.5rem_5.5rem_auto] gap-3 px-1 text-xs font-medium lg:grid">
        <span>Omschrijving</span>
        <span>Hoort bij</span>
        <span className="text-right">Bedrag incl. BTW</span>
        <span>BTW</span>
        <span className="w-[4.75rem]" />
      </div>
      <ul className="space-y-3 lg:space-y-2">
        {rijen.map((r, i) => {
          const id = `${basisId}-${r.sleutel}`;
          const bedrag = parseEuro(r.bedragTekst);
          const bedragFout = r.bedragTekst.trim() !== "" && bedrag === null;
          return (
            <li
              key={r.sleutel}
              className="border-border rounded-xl border p-3 lg:border-0 lg:p-0"
            >
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1.2fr_1.5fr_8.5rem_5.5rem_auto] lg:items-start lg:gap-3">
                <div className="col-span-2 lg:col-span-1">
                  <label
                    htmlFor={`${id}-oms`}
                    className="mb-1 block text-xs font-medium lg:sr-only"
                  >
                    Omschrijving regel {i + 1}
                  </label>
                  <input
                    id={`${id}-oms`}
                    className={invoerKlassen}
                    placeholder="Bijv. tegels badkamer"
                    value={r.omschrijving}
                    maxLength={300}
                    onChange={(e) =>
                      wijzig(r.sleutel, { omschrijving: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2 lg:col-span-1">
                  <label
                    htmlFor={`${id}-doel`}
                    className="mb-1 block text-xs font-medium lg:sr-only"
                  >
                    Hoort bij regel {i + 1}
                  </label>
                  <select
                    id={`${id}-doel`}
                    className={invoerKlassen}
                    value={r.doel}
                    onChange={(e) =>
                      wijzig(r.sleutel, { doel: e.target.value })
                    }
                  >
                    <option value="">Kies contract of categorie</option>
                    {doelen.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.opties.map((o) => (
                          <option key={o.waarde} value={o.waarde}>
                            {o.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`${id}-bedrag`}
                    className="mb-1 block text-xs font-medium lg:sr-only"
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
                    className="mb-1 block text-xs font-medium lg:sr-only"
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
                <div className="col-span-2 flex justify-end gap-1 lg:col-span-1">
                  {ruimtes.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        wijzig(r.sleutel, { ruimtesOpen: !r.ruimtesOpen })
                      }
                      aria-expanded={r.ruimtesOpen}
                      className={knopKlassen(
                        "stil",
                        cn(
                          "px-2.5 py-2.5",
                          r.ruimtes.length > 0 && "text-accent-ink",
                        ),
                      )}
                      title="Ruimtes"
                    >
                      <DoorOpen className="size-4" />
                      {r.ruimtes.length > 0 && (
                        <span className="text-xs tabular-nums">
                          {r.ruimtes.length}
                        </span>
                      )}
                      <span className="sr-only">Ruimtes regel {i + 1}</span>
                    </button>
                  )}
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
              </div>
              {!r.ruimtesOpen && r.ruimtes.length > 0 && (
                <p className="text-muted mt-1.5 flex items-center gap-1 px-1 text-xs">
                  <DoorOpen className="size-3" />
                  {r.ruimtes.map((x) => ruimteNaam.get(x) ?? "?").join(", ")}
                  <span className="text-subtle">(gelijk verdeeld)</span>
                </p>
              )}
              {r.ruimtesOpen && (
                <fieldset className="bg-surface-2 mt-2 rounded-xl p-3">
                  <legend className="sr-only">Ruimtes van regel {i + 1}</legend>
                  <p className="text-muted mb-2 text-xs">
                    Optioneel. Het bedrag wordt gelijk over de gekozen ruimtes
                    verdeeld. Bij een contractregel zonder keuze gelden de
                    ruimtes van het contract.
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                    {ruimtes.map((x) => (
                      <label
                        key={x.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={r.ruimtes.includes(x.id)}
                          onChange={(e) =>
                            wijzig(r.sleutel, {
                              ruimtes: e.target.checked
                                ? [...r.ruimtes, x.id]
                                : r.ruimtes.filter((y) => y !== x.id),
                            })
                          }
                          className="accent-accent size-4 shrink-0"
                        />
                        {x.naam}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
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
              nieuweRij(volgnummer, standaardDoel),
            ]);
            setVolgnummer((n) => n + 1);
          }}
          className={knopKlassen("secundair", "px-3 py-2")}
        >
          <Plus className="size-4" />
          Regel toevoegen
        </button>
        <div className="text-right text-sm">
          <p>
            <span className="text-muted">Totaal regels incl. BTW </span>
            <span className="font-semibold tabular-nums">
              {formatEuro(totaal)}
            </span>
          </p>
          {verschil !== 0 && (
            <p className="text-warning text-xs font-medium" role="status">
              {verschil > 0
                ? `${formatEuro(verschil)} meer dan het totaal op het document`
                : `Nog ${formatEuro(-verschil)} te verdelen tot het totaal op het document`}
            </p>
          )}
          {totaalOpDocument !== null &&
            verschil === 0 &&
            rijen.some((r) => r.bedragTekst.trim()) && (
              <p className="text-positive text-xs font-medium" role="status">
                Klopt met het totaal op het document
              </p>
            )}
        </div>
      </div>
    </div>
  );
}
