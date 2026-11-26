import {
  ChevronRight,
  FileMinus,
  FileText,
  type LucideIcon,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status";
import type { DocumentItem } from "@/lib/data/documenten";
import { formatDatum, formatEuro } from "@/lib/format";
import { BETAALSTATUS, DOCUMENT_TYPE, STATUS_DOCUMENT } from "@/lib/labels";

const ICOON: Record<DocumentItem["type"], LucideIcon> = {
  factuur: FileText,
  termijnfactuur: FileText,
  eindfactuur: FileText,
  creditnota: FileMinus,
  bon: Receipt,
};

function vervalTekst(d: DocumentItem) {
  if (d.status !== "geboekt" || d.openstaand === 0) return null;
  const dagen = d.dagenTotVervallen;
  if (dagen === null) return null;
  if (dagen < 0)
    return {
      tekst: `${-dagen} ${dagen === -1 ? "dag" : "dagen"} te laat`,
      te_laat: true,
    };
  if (dagen === 0) return { tekst: "Vandaag betalen", te_laat: false };
  if (dagen <= 14)
    return {
      tekst: `Over ${dagen} ${dagen === 1 ? "dag" : "dagen"} betalen`,
      te_laat: false,
    };
  return null;
}

/** Lijst van facturen en bonnen met bedrag en (betaal)status. */
export function DocumentLijst({
  documenten,
  leeg,
  toonContract = true,
  bedragen,
}: {
  documenten: DocumentItem[];
  leeg: React.ReactNode;
  toonContract?: boolean;
  /** Ander bedrag per document tonen, bijv. alleen het deel in een categorie. */
  bedragen?: Map<string, number>;
}) {
  if (!documenten.length) {
    return (
      <div className="border-border text-muted border-t px-5 py-5 text-sm sm:px-6">
        {leeg}
      </div>
    );
  }
  return (
    <ul>
      {documenten.map((d) => {
        const Icon = ICOON[d.type];
        const verval = vervalTekst(d);
        const pil = d.betaalStatus
          ? BETAALSTATUS[d.betaalStatus]
          : STATUS_DOCUMENT[d.status];
        return (
          <li key={d.id} className="border-border border-t">
            <Link
              href={`/documenten/${d.id}`}
              className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3.5 sm:px-6"
            >
              <span className="bg-accent-soft text-accent-ink hidden size-9 shrink-0 items-center justify-center rounded-full sm:flex">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.titel}</p>
                <p className="text-muted truncate text-xs">
                  {[
                    DOCUMENT_TYPE[d.type].tekst,
                    d.nummer,
                    formatDatum(d.datum),
                    toonContract && d.contractTitel,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {verval && (
                  <p
                    className={`mt-0.5 text-xs font-medium ${verval.te_laat ? "text-critical" : "text-warning"}`}
                  >
                    {verval.tekst}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`text-sm font-medium tabular-nums ${d.status === "vervallen" ? "text-muted line-through" : ""}`}
                >
                  {formatEuro(bedragen?.get(d.id) ?? d.totaal)}
                </span>
                <StatusPill soort={pil.soort}>{pil.tekst}</StatusPill>
              </div>
              <ChevronRight className="text-subtle size-4 shrink-0" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
