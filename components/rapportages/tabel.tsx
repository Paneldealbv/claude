import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDatum, formatEuro, formatEuroVerschil } from "@/lib/format";
import type { Kolom, Rapport } from "@/lib/rapportages";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function opmaak(w: string | number | null, k: Kolom) {
  if (w === null || w === "") return null;
  if (typeof w === "number") {
    if (k.soort !== "bedrag") return String(w);
    return k.verschil ? formatEuroVerschil(w) : formatEuro(w);
  }
  return k.soort === "datum" && ISO.test(w) ? formatDatum(w) : w;
}

/**
 * Rapport als tabel. Bij een boom (categorieën) worden hoofd- en
 * subcategorie één ingesprongen kolom. Een balk toont de verhouding tot de
 * grootste waarde; de bedragen staan er altijd als tekst bij.
 */
export function RapportTabel({ rapport }: { rapport: Rapport }) {
  const kolommen: Kolom[] = rapport.boom
    ? [{ label: "Categorie", soort: "tekst" }, ...rapport.kolommen.slice(2)]
    : rapport.kolommen;
  const cellenVan = (r: Rapport["rijen"][number]) =>
    rapport.boom
      ? [r.niveau === 1 ? r.cellen[1] : r.cellen[0], ...r.cellen.slice(2)]
      : r.cellen;
  const maxima = kolommen.map((k, j) =>
    k.balk
      ? Math.max(
          1,
          ...rapport.rijen
            .filter((r) => !r.totaal)
            .map((r) => Math.abs(Number(cellenVan(r)[j] ?? 0))),
        )
      : 0,
  );
  const links = (k: Kolom) => k.soort === "tekst" || k.soort === "datum";
  // Expliciete opvulling per positie (geen first:/last:, zodat inspringen werkt).
  const rand = (j: number) =>
    j === 0
      ? "pl-5 pr-3 sm:pl-6"
      : j === kolommen.length - 1
        ? "pr-5 pl-3 sm:pr-6"
        : "px-3";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm print:min-w-0 print:text-[8.5pt]">
        <caption className="sr-only">{rapport.titel}</caption>
        <thead>
          <tr className="border-border text-muted border-y text-xs">
            {kolommen.map((k) => (
              <th
                key={k.label}
                scope="col"
                className={cn(
                  "py-2 font-medium print:px-1.5 print:py-1",
                  rand(kolommen.indexOf(k)),
                  links(k) ? "text-left" : "text-right",
                )}
              >
                {k.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rapport.rijen.map((r, i) => {
            const cellen = cellenVan(r);
            return (
              <tr
                key={i}
                className={cn(
                  "border-border break-inside-avoid border-b",
                  r.totaal && "bg-surface-2 border-t font-semibold",
                  rapport.boom && r.niveau === 0 && !r.totaal && "font-medium",
                )}
              >
                {cellen.map((w, j) => {
                  const k = kolommen[j];
                  const inhoud = opmaak(w, k);
                  const klassen = cn(
                    "py-2.5 print:px-1.5 print:py-1",
                    j === 0 && rapport.boom && r.niveau === 1
                      ? "pr-3 pl-10 sm:pl-11 print:pl-4"
                      : rand(j),
                    links(k) ? "text-left" : "text-right whitespace-nowrap",
                  );
                  if (j === 0) {
                    return (
                      <th
                        key={j}
                        scope="row"
                        className={cn(klassen, "[font-weight:inherit]")}
                      >
                        {r.href && !r.totaal ? (
                          <Link
                            href={r.href}
                            className="hover:text-accent-ink hover:underline"
                          >
                            {inhoud}
                          </Link>
                        ) : (
                          inhoud
                        )}
                      </th>
                    );
                  }
                  return (
                    <td key={j} className={klassen}>
                      {inhoud ?? <span className="text-subtle">—</span>}
                      {k.balk && !r.totaal && typeof w === "number" && (
                        <div
                          aria-hidden="true"
                          className="bg-surface-2 mt-1.5 ml-auto h-1.5 w-28 overflow-hidden rounded-full"
                        >
                          <div
                            className="bg-series-1 h-full rounded-full"
                            style={{
                              width: `${(Math.abs(w) / maxima[j]) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
