import { ArrowRight, Copy, ScanSearch } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusPill, type StatusSoort } from "@/components/ui/status";
import { formatDatum, formatEuro } from "@/lib/format";
import type { OpenPost } from "@/lib/demo/dashboard";
import type { DemoControle, demoActiviteit } from "@/lib/demo/data";

function MeerLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="text-accent-ink hover:bg-accent-soft -mr-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium"
    >
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

export function OpenPosten({ posten }: { posten: OpenPost[] }) {
  const totaal = posten.reduce((t, p) => t + p.openstaand, 0);
  return (
    <Card aria-labelledby="open-titel">
      <CardHeader
        id="open-titel"
        title="Te betalen"
        description={`${posten.length} openstaande facturen · ${formatEuro(totaal, { centen: false })}`}
        action={<MeerLink href="/documenten">Alle facturen</MeerLink>}
      />
      <ul className="mt-3 pb-2">
        {posten.map((p) => {
          const dagen = p.dagenTotVervallen;
          const soort: StatusSoort =
            dagen === null
              ? "neutraal"
              : dagen < 0
                ? "kritiek"
                : dagen <= 7
                  ? "waarschuwing"
                  : "neutraal";
          return (
            <li
              key={p.id}
              className="border-border flex flex-col gap-2 border-t px-5 py-3.5 first:border-0 sm:flex-row sm:items-center sm:gap-4 sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.omschrijving}</p>
                <p className="text-muted truncate text-xs">
                  {p.leverancier} · {p.type} · betalen uit {p.bron}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <StatusPill soort={soort}>
                  {dagen !== null && dagen < 0
                    ? "Vervallen"
                    : p.vervaldatum
                      ? `Uiterlijk ${formatDatum(p.vervaldatum)}`
                      : "Geen vervaldatum"}
                </StatusPill>
                <span className="w-24 text-right text-sm font-semibold tabular-nums">
                  {formatEuro(p.openstaand, { centen: false })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const puntSoort: Record<DemoControle["punten"][number]["soort"], StatusSoort> =
  {
    ontbreekt: "kritiek",
    "klopt-niet": "kritiek",
    onzeker: "waarschuwing",
    duplicaat: "waarschuwing",
  };

export function TeControleren({ items }: { items: DemoControle[] }) {
  return (
    <Card aria-labelledby="controle-titel">
      <CardHeader
        id="controle-titel"
        title="Te controleren"
        description="AI-voorstellen · tellen pas mee na bevestiging"
        action={<MeerLink href="/te-controleren">Controleren</MeerLink>}
      />
      <ul className="mt-3 pb-2">
        {items.map((d) => (
          <li
            key={d.id}
            className="border-border flex items-start gap-3 border-t px-5 py-3.5 first:border-0 sm:px-6"
          >
            <span className="bg-surface-2 text-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
              <ScanSearch className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium">{d.leverancier}</p>
                <span className="text-sm font-medium whitespace-nowrap tabular-nums">
                  {formatEuro(d.bedrag)}
                </span>
              </div>
              <p className="text-muted text-xs">
                {d.titel} · {d.regels} {d.regels === 1 ? "regel" : "regels"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.punten.map((p) => (
                  <StatusPill
                    key={p.tekst}
                    soort={puntSoort[p.soort]}
                    icon={p.soort === "duplicaat" ? Copy : undefined}
                  >
                    {p.tekst}
                  </StatusPill>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Activiteit({ items }: { items: typeof demoActiviteit }) {
  return (
    <Card aria-labelledby="activiteit-titel">
      <CardHeader id="activiteit-titel" title="Recente activiteit" />
      <ol className="mt-4 px-5 pb-5 sm:px-6">
        {items.map((a, i) => (
          <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < items.length - 1 && (
              <span
                aria-hidden="true"
                className="bg-border absolute top-8 bottom-0 left-[13px] w-px"
              />
            )}
            <span className="bg-surface-2 text-muted flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
              {a.wie.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 pt-0.5 text-sm">
              <p>
                <span className="font-medium">{a.wie}</span>{" "}
                <span className="text-muted">{a.wat}</span>
                {a.bedrag !== null && (
                  <span className="font-medium whitespace-nowrap tabular-nums">
                    {" "}
                    · {formatEuro(a.bedrag, { centen: false })}
                  </span>
                )}
              </p>
              <p className="text-subtle mt-0.5 text-xs">{a.wanneer}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
