import { ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { StatusPill, type StatusSoort } from "@/components/ui/status";
import type { VoorstelRij } from "@/lib/data/herkenning";
import { formatDatum, formatEuro } from "@/lib/format";
import { DOCUMENT_TYPE } from "@/lib/labels";

function status(v: VoorstelRij): { soort: StatusSoort; tekst: string } {
  if (v.vastgelopen) return { soort: "kritiek", tekst: "Afgebroken" };
  switch (v.status) {
    case "wachtrij":
    case "bezig":
      return { soort: "info", tekst: "Wordt uitgelezen" };
    case "mislukt":
      return { soort: "kritiek", tekst: "Niet gelukt" };
    default: {
      const ernstig = v.punten.some((p) => p.soort !== "onzeker");
      return v.punten.length
        ? {
            soort: ernstig ? "kritiek" : "waarschuwing",
            tekst: `${v.punten.length} ${v.punten.length === 1 ? "punt" : "punten"}`,
          }
        : { soort: "positief", tekst: "Klaar om te boeken" };
    }
  }
}

/** Voorstellen van de AI die nog gecontroleerd moeten worden. */
export function VoorstelLijst({ voorstellen }: { voorstellen: VoorstelRij[] }) {
  return (
    <ul>
      {voorstellen.map((v) => {
        const s = status(v);
        const soort = v.soort ? DOCUMENT_TYPE[v.soort].tekst : null;
        return (
          <li key={v.id} className="border-border border-t">
            <Link
              href={`/te-controleren/${v.id}`}
              className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3.5 sm:px-6"
            >
              <span className="bg-gold/15 text-gold hidden size-9 shrink-0 items-center justify-center rounded-full sm:flex">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {v.leverancier ?? v.bestand.naam}
                </p>
                <p className="text-muted truncate text-xs">
                  {[
                    soort ?? "AI-voorstel",
                    v.nummer,
                    v.datum && /^\d{4}-\d{2}-\d{2}$/.test(v.datum)
                      ? formatDatum(v.datum)
                      : null,
                    v.leverancier ? v.bestand.naam : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {v.totaal !== null && (
                  <span className="text-sm font-medium tabular-nums">
                    {formatEuro(
                      v.soort === "creditnota" ? -v.totaal : v.totaal,
                    )}
                  </span>
                )}
                <StatusPill soort={s.soort}>{s.tekst}</StatusPill>
              </div>
              <ChevronRight className="text-subtle size-4 shrink-0" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
