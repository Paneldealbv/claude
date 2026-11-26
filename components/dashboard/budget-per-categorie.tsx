"use client";

import { ChartBarBig, Lock, Table2 } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { formatEuro, formatEuroVerschil } from "@/lib/format";
import { prognose, type DemoCategorie } from "@/lib/demo/data";

const heel = { centen: false } as const;

function Afwijking({ c }: { c: DemoCategorie }) {
  const verschil = prognose(c) - c.budget;
  if (verschil > 0)
    return (
      <StatusPill soort="kritiek">
        {formatEuroVerschil(verschil, heel)}
      </StatusPill>
    );
  if (verschil < 0)
    return (
      <StatusPill soort="positief">
        {formatEuroVerschil(verschil, heel)}
      </StatusPill>
    );
  return null;
}

function Legenda() {
  return (
    <ul className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <li className="flex items-center gap-1.5">
        <span className="bg-series-1 h-2.5 w-3 rounded-sm" />
        Gefactureerd
      </li>
      <li className="flex items-center gap-1.5">
        <span className="bg-series-1-wash h-2.5 w-3 rounded-sm" />
        Prognose
      </li>
      <li className="flex items-center gap-1.5">
        <span className="bg-foreground h-3 w-0.5 rounded-full" />
        Budget
      </li>
    </ul>
  );
}

/**
 * Per categorie: hoeveel van het budget is gefactureerd en wat de prognose is.
 * Bars zijn genormaliseerd op het budget van de categorie (streep = 100%),
 * zodat een kleine post en de aanneemsom even goed leesbaar zijn.
 */
export function BudgetPerCategorie({
  categorieen,
}: {
  categorieen: DemoCategorie[];
}) {
  const [weergave, setWeergave] = useState<"grafiek" | "tabel">("grafiek");
  const schaal = Math.max(
    1.1,
    ...categorieen.map((c) => prognose(c) / c.budget),
  );
  const pct = (v: number) => `${(v / schaal) * 100}%`;

  return (
    <Card aria-labelledby="budget-titel" className="pb-2">
      <CardHeader
        id="budget-titel"
        title="Budget en prognose per categorie"
        description="Inclusief BTW · alleen geboekte documenten tellen mee"
        action={
          <div
            role="radiogroup"
            aria-label="Weergave"
            className="bg-surface-2 flex rounded-lg p-0.5"
          >
            {(
              [
                ["grafiek", ChartBarBig, "Grafiek"],
                ["tabel", Table2, "Tabel"],
              ] as const
            ).map(([waarde, Icon, label]) => (
              <button
                key={waarde}
                type="button"
                role="radio"
                aria-checked={weergave === waarde}
                onClick={() => setWeergave(waarde)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  weergave === waarde
                    ? "bg-surface text-foreground shadow-card"
                    : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        }
      />

      {weergave === "grafiek" ? (
        <>
          <div className="px-5 pt-4 sm:px-6">
            <Legenda />
          </div>
          <ul className="mt-2">
            {categorieen.map((c) => {
              const p = prognose(c);
              return (
                <li
                  key={c.id}
                  tabIndex={0}
                  className="group hover:bg-surface-2 focus-visible:bg-surface-2 relative grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-2.5 outline-none sm:grid-cols-[11rem_1fr_9.5rem] sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm">{c.naam}</span>
                    {c.afgesloten && (
                      <Lock
                        className="text-subtle size-3.5 shrink-0"
                        aria-label="Afgesloten"
                      />
                    )}
                  </div>

                  <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <div className="relative h-3">
                      <div
                        className="bg-series-1-wash absolute inset-y-0 left-0 rounded-r"
                        style={{ width: pct(p / c.budget) }}
                      />
                      <div
                        className="bg-series-1 absolute inset-y-0 left-0 rounded-r"
                        style={{ width: pct(c.gefactureerd / c.budget) }}
                      />
                      <div
                        className="bg-foreground absolute -inset-y-1 w-0.5 rounded-full"
                        style={{ left: `calc(${pct(1)} - 1px)` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 sm:col-start-3">
                    <Afwijking c={c} />
                    <span className="text-sm font-medium tabular-nums">
                      {formatEuro(p, heel)}
                    </span>
                  </div>

                  {/* Tooltip bij hover of focus */}
                  <div
                    role="tooltip"
                    className="border-border bg-surface shadow-pop pointer-events-none absolute top-full left-5 z-20 mt-1 hidden w-64 rounded-xl border p-3 text-xs group-focus-visible:block sm:left-[12.5rem] sm:group-hover:block"
                  >
                    <p className="mb-2 text-sm font-semibold">{c.naam}</p>
                    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
                      <dt className="text-muted">Budget</dt>
                      <dd className="text-right">{formatEuro(c.budget)}</dd>
                      <dt className="text-muted">Gecontracteerd</dt>
                      <dd className="text-right">
                        {formatEuro(c.gecontracteerd)}
                      </dd>
                      <dt className="text-muted">Gefactureerd</dt>
                      <dd className="text-right">
                        {formatEuro(c.gefactureerd)}
                      </dd>
                      <dt className="text-muted">Betaald</dt>
                      <dd className="text-right">{formatEuro(c.betaald)}</dd>
                      <dt className="border-border mt-1 border-t pt-1 font-medium">
                        Prognose
                      </dt>
                      <dd className="border-border mt-1 border-t pt-1 text-right font-medium">
                        {formatEuro(p)}
                      </dd>
                    </dl>
                    <p className="text-muted mt-2 leading-relaxed">
                      {c.afgesloten
                        ? "Afgesloten: prognose = werkelijke kosten."
                        : "Open: prognose is minimaal het budget."}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">
              Budget, gecontracteerd, gefactureerd, betaald en prognose per
              categorie
            </caption>
            <thead>
              <tr className="border-border text-muted border-y text-left text-xs">
                <th scope="col" className="px-5 py-2 font-medium sm:px-6">
                  Categorie
                </th>
                {[
                  "Budget",
                  "Gecontracteerd",
                  "Gefactureerd",
                  "Betaald",
                  "Prognose",
                  "Afwijking",
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-3 py-2 text-right font-medium last:pr-5 sm:last:pr-6"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {categorieen.map((c) => (
                <tr key={c.id} className="border-border border-b last:border-0">
                  <th
                    scope="row"
                    className="px-5 py-2.5 text-left font-normal sm:px-6"
                  >
                    {c.naam}
                    {c.afgesloten && (
                      <span className="text-subtle ml-1.5 text-xs">
                        (afgesloten)
                      </span>
                    )}
                  </th>
                  <td className="px-3 text-right">
                    {formatEuro(c.budget, heel)}
                  </td>
                  <td className="px-3 text-right">
                    {formatEuro(c.gecontracteerd, heel)}
                  </td>
                  <td className="px-3 text-right">
                    {formatEuro(c.gefactureerd, heel)}
                  </td>
                  <td className="px-3 text-right">
                    {formatEuro(c.betaald, heel)}
                  </td>
                  <td className="px-3 text-right font-medium">
                    {formatEuro(prognose(c), heel)}
                  </td>
                  <td className="px-3 pr-5 text-right sm:pr-6">
                    {formatEuroVerschil(prognose(c) - c.budget, heel)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
