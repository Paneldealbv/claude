import { ArrowRight, Copy, ScanSearch } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusPill, type StatusSoort } from "@/components/ui/status";
import type { ActiviteitItem, ControleItem, OpenPost } from "@/lib/dashboard";
import { formatDatum, formatEuro } from "@/lib/format";

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

/** Rij die naar een detailpagina linkt als er een href is. */
function RijLink({
  href,
  className,
  children,
}: {
  href?: string;
  className: string;
  children: ReactNode;
}) {
  return href ? (
    <Link href={href} className={`${className} hover:bg-surface-2`}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

function Leeg({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted px-5 pt-3 pb-5 text-sm sm:px-6">{children}</p>
  );
}

export function OpenPosten({ posten }: { posten: OpenPost[] }) {
  const totaal = posten.reduce((t, p) => t + p.openstaand, 0);
  return (
    <Card aria-labelledby="open-titel">
      <CardHeader
        id="open-titel"
        title="Te betalen"
        description={
          posten.length
            ? `${posten.length} ${posten.length === 1 ? "openstaande factuur" : "openstaande facturen"} · ${formatEuro(totaal, { centen: false })}`
            : "Alle geboekte facturen zijn betaald."
        }
        action={<MeerLink href="/documenten">Alle facturen</MeerLink>}
      />
      {posten.length === 0 ? (
        <Leeg>Er staat niets open.</Leeg>
      ) : (
        <ul className="mt-3 pb-2">
          {posten.slice(0, 8).map((p) => {
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
              <li key={p.id} className="border-border border-t first:border-0">
                <RijLink
                  href={p.href}
                  className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.omschrijving}
                    </p>
                    <p className="text-muted truncate text-xs">
                      {[
                        p.leverancier,
                        p.type,
                        p.bron && `betalen uit ${p.bron}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <StatusPill soort={soort}>
                      {dagen !== null && dagen < 0
                        ? "Te laat"
                        : p.vervaldatum
                          ? `Uiterlijk ${formatDatum(p.vervaldatum)}`
                          : "Geen vervaldatum"}
                    </StatusPill>
                    <span className="w-24 text-right text-sm font-semibold tabular-nums">
                      {formatEuro(p.openstaand, { centen: false })}
                    </span>
                  </div>
                </RijLink>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const puntSoort: Record<ControleItem["punten"][number]["soort"], StatusSoort> =
  {
    ontbreekt: "kritiek",
    "klopt-niet": "kritiek",
    onzeker: "waarschuwing",
    duplicaat: "waarschuwing",
    status: "waarschuwing",
  };

export function TeControleren({
  items,
  omschrijving = "Tellen pas mee na controle en boeken",
}: {
  items: ControleItem[];
  omschrijving?: string;
}) {
  return (
    <Card aria-labelledby="controle-titel">
      <CardHeader
        id="controle-titel"
        title="Te controleren"
        description={omschrijving}
        action={<MeerLink href="/te-controleren">Controleren</MeerLink>}
      />
      {items.length === 0 ? (
        <Leeg>Alles is geboekt. Er staat niets te wachten.</Leeg>
      ) : (
        <ul className="mt-3 pb-2">
          {items.slice(0, 6).map((d) => (
            <li key={d.id} className="border-border border-t first:border-0">
              <RijLink
                href={d.href}
                className="flex items-start gap-3 px-5 py-3.5 sm:px-6"
              >
                <span className="bg-surface-2 text-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <ScanSearch className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">
                      {d.leverancier}
                    </p>
                    {d.bedrag !== null && (
                      <span className="text-sm font-medium whitespace-nowrap tabular-nums">
                        {formatEuro(d.bedrag)}
                      </span>
                    )}
                  </div>
                  <p className="text-muted text-xs">
                    {d.titel}
                    {d.regels !== undefined &&
                      ` · ${d.regels} ${d.regels === 1 ? "regel" : "regels"}`}
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
              </RijLink>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Activiteit({ items }: { items: ActiviteitItem[] }) {
  return (
    <Card aria-labelledby="activiteit-titel">
      <CardHeader id="activiteit-titel" title="Recente activiteit" />
      {items.length === 0 ? (
        <Leeg>Nog geen activiteit.</Leeg>
      ) : (
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
                  {a.href ? (
                    <Link href={a.href} className="text-muted hover:underline">
                      {a.wat}
                    </Link>
                  ) : (
                    <span className="text-muted">{a.wat}</span>
                  )}
                  {a.bedrag !== null && (
                    <span className="font-medium whitespace-nowrap tabular-nums">
                      {" "}
                      · {formatEuro(a.bedrag, { centen: false })}
                    </span>
                  )}
                </p>
                <p className="text-muted mt-0.5 text-xs">{a.wanneer}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
