import { ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import type { CategorieResultaat, Cijfers } from "@/lib/finance";
import { formatEuro, formatEuroVerschil } from "@/lib/format";

const heel = { centen: false } as const;

export function Afwijking({ bedrag }: { bedrag: number }) {
  if (bedrag === 0) return <span className="text-muted">—</span>;
  return (
    <StatusPill soort={bedrag > 0 ? "kritiek" : "positief"}>
      {formatEuroVerschil(bedrag, heel)}
    </StatusPill>
  );
}

const kolommen: { veld: keyof Cijfers; label: string; breed?: boolean }[] = [
  { veld: "budget", label: "Budget" },
  { veld: "gecontracteerd", label: "Gecontracteerd", breed: true },
  { veld: "gefactureerd", label: "Gefactureerd", breed: true },
  { veld: "betaald", label: "Betaald", breed: true },
  { veld: "prognose", label: "Prognose" },
];

/**
 * Categorieboom met de kerncijfers. Hoofdcategorieën tellen hun
 * subcategorieën op. Elke regel opent de categorie.
 */
export function CategorieTabel({
  categorieen,
  totaal,
}: {
  categorieen: CategorieResultaat[];
  totaal: Cijfers;
}) {
  return (
    <>
      {/* Tablet en groter: tabel */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Budget, gecontracteerd, gefactureerd, betaald, prognose en afwijking
            per categorie
          </caption>
          <thead>
            <tr className="border-border text-muted border-b text-left text-xs">
              <th scope="col" className="px-6 py-2.5 font-medium">
                Categorie
              </th>
              {kolommen.map((k) => (
                <th
                  key={k.veld}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 text-right font-medium",
                    k.breed && "hidden xl:table-cell",
                  )}
                >
                  {k.label}
                </th>
              ))}
              <th scope="col" className="px-6 py-2.5 text-right font-medium">
                Afwijking
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {categorieen.map((c) => {
              const hoofd = !c.isBlad;
              return (
                <tr
                  key={c.id}
                  className={cn(
                    "border-border hover:bg-surface-2 group border-b last:border-0",
                    hoofd && "bg-surface-2/60",
                  )}
                >
                  <th scope="row" className="py-0 text-left font-normal">
                    <Link
                      href={`/budget/${c.id}`}
                      className="flex items-center gap-2 py-2.5 pr-3 outline-none"
                      style={{ paddingLeft: `${1.5 + c.diepte * 1.25}rem` }}
                    >
                      <span
                        className={cn("truncate", hoofd && "font-semibold")}
                      >
                        {c.naam}
                      </span>
                      {c.afgesloten && (
                        <Lock
                          className="text-subtle size-3.5 shrink-0"
                          aria-label="Afgesloten"
                        />
                      )}
                      <ChevronRight className="text-subtle size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </th>
                  {kolommen.map((k) => (
                    <td
                      key={k.veld}
                      className={cn(
                        "px-3 py-2.5 text-right",
                        k.breed && "hidden xl:table-cell",
                        hoofd && "font-semibold",
                        k.veld === "prognose" && "font-medium",
                      )}
                    >
                      {formatEuro(c.cijfers[k.veld], heel)}
                    </td>
                  ))}
                  <td className="px-6 py-2.5 text-right">
                    <Afwijking bedrag={c.cijfers.afwijking} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="tabular-nums">
            <tr className="border-border-strong border-t-2 font-semibold">
              <th scope="row" className="px-6 py-3 text-left">
                Totaal
              </th>
              {kolommen.map((k) => (
                <td
                  key={k.veld}
                  className={cn(
                    "px-3 py-3 text-right",
                    k.breed && "hidden xl:table-cell",
                  )}
                >
                  {formatEuro(totaal[k.veld], heel)}
                </td>
              ))}
              <td className="px-6 py-3 text-right">
                <Afwijking bedrag={totaal.afwijking} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Telefoon: lijst */}
      <ul className="md:hidden">
        {categorieen.map((c) => (
          <li key={c.id} className="border-border border-b last:border-0">
            <Link
              href={`/budget/${c.id}`}
              className={cn(
                "active:bg-surface-2 flex items-center gap-3 py-3 pr-4",
                !c.isBlad && "bg-surface-2/60",
              )}
              style={{ paddingLeft: `${1.25 + c.diepte * 1}rem` }}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-sm",
                    !c.isBlad && "font-semibold",
                  )}
                >
                  <span className="truncate">{c.naam}</span>
                  {c.afgesloten && (
                    <Lock
                      className="text-subtle size-3.5 shrink-0"
                      aria-label="Afgesloten"
                    />
                  )}
                </p>
                <p className="text-muted mt-0.5 text-xs tabular-nums">
                  Budget {formatEuro(c.cijfers.budget, heel)} · betaald{" "}
                  {formatEuro(c.cijfers.betaald, heel)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-medium tabular-nums">
                  {formatEuro(c.cijfers.prognose, heel)}
                </span>
                {c.cijfers.afwijking !== 0 && (
                  <Afwijking bedrag={c.cijfers.afwijking} />
                )}
              </div>
              <ChevronRight className="text-subtle size-4 shrink-0" />
            </Link>
          </li>
        ))}
        <li className="border-border-strong flex items-center justify-between border-t-2 px-5 py-3 text-sm font-semibold tabular-nums">
          <span>Totaal prognose</span>
          <span>{formatEuro(totaal.prognose, heel)}</span>
        </li>
      </ul>
    </>
  );
}
