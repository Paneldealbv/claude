import {
  Banknote,
  ChevronRight,
  Gift,
  HandCoins,
  Landmark,
  type LucideIcon,
  PiggyBank,
  Plus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { StatusPill } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import type {
  BronWeergave,
  DeelWeergave,
  DepotWeergave,
} from "@/lib/data/financiering";
import { formatDatum, formatEuro, formatProcent } from "@/lib/format";
import { BRON_TYPE, STATUS_DECLARATIE, type BronSoort } from "@/lib/labels";

const ICOON: Partial<Record<BronSoort, LucideIcon>> = {
  eigen_geld: PiggyBank,
  hypotheek: Landmark,
  schenking: Gift,
  lening: HandCoins,
  overig: Wallet,
};

/** Balk: hoeveel van de bron is betaald. */
function Voortgang({
  betaald,
  bedrag,
  label,
}: {
  betaald: number;
  bedrag: number;
  label: string;
}) {
  const deel = bedrag > 0 ? Math.min(1, Math.max(0, betaald / bedrag)) : 0;
  return (
    <div
      role="img"
      aria-label={label}
      className="bg-surface-2 h-1.5 w-full overflow-hidden rounded-full"
    >
      <div
        className={cn(
          "h-full rounded-full",
          betaald > bedrag ? "bg-critical" : "bg-accent",
        )}
        style={{ width: `${deel * 100}%` }}
      />
    </div>
  );
}

function Cijfers({ b }: { b: DeelWeergave }) {
  return (
    <div className="mt-2 space-y-1.5">
      <Voortgang
        betaald={b.betaald}
        bedrag={b.bedrag}
        label={`${formatEuro(b.betaald)} van ${formatEuro(b.bedrag)} betaald`}
      />
      <p className="text-muted flex flex-wrap justify-between gap-x-4 text-xs">
        <span>Betaald {formatEuro(b.betaald)}</span>
        <span
          className={cn(
            "font-medium",
            b.saldo < 0 ? "text-critical" : "text-foreground",
          )}
        >
          Saldo {formatEuro(b.saldo)}
        </span>
      </p>
    </div>
  );
}

/** Alle bronnen met bedrag, betaald en saldo; een hypotheek met zijn delen. */
export function BronnenKaart({
  bronnen,
  totaal,
  betaaldZonderBron,
}: {
  bronnen: BronWeergave[];
  totaal: number;
  betaaldZonderBron: number;
}) {
  return (
    <Card aria-labelledby="bronnen-titel" className="overflow-hidden">
      <CardHeader
        id="bronnen-titel"
        title="Bronnen"
        description="Bedrag, wat eruit betaald is en wat er nog over is."
        className="pb-4"
      />
      <ul>
        {bronnen.map((b) => {
          const Icon = ICOON[b.type] ?? Banknote;
          const details = [
            BRON_TYPE[b.type].tekst,
            b.verstrekker,
            b.renteBp !== null && `${formatProcent(b.renteBp)} rente`,
            b.eind && `tot ${formatDatum(b.eind)}`,
          ].filter(Boolean);
          return (
            <li key={b.id} className="border-border border-t">
              <Link
                href={`/financiering/${b.id}`}
                className="hover:bg-surface-2 flex items-start gap-3 px-5 py-4 sm:px-6"
              >
                <span className="bg-accent-soft text-accent-ink hidden size-9 shrink-0 items-center justify-center rounded-full sm:flex">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">{b.naam}</p>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatEuro(b.bedrag)}
                    </span>
                  </div>
                  <p className="text-muted truncate text-xs">
                    {details.join(" · ")}
                  </p>
                  {b.delen.length === 0 && <Cijfers b={b} />}
                </div>
                <ChevronRight className="text-subtle mt-0.5 size-4 shrink-0" />
              </Link>
              {b.delen.length > 0 && (
                <ul className="pb-3">
                  {b.delen.map((d) => (
                    <li
                      key={d.id}
                      className="border-border mr-5 ml-5 border-l-2 py-2 pl-4 sm:mr-6 sm:ml-[4.25rem]"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm">
                          {d.naam}
                          {d.type === "bouwdepot" && d.eind && (
                            <span className="text-muted text-xs">
                              {" "}
                              · loopt tot {formatDatum(d.eind)}
                            </span>
                          )}
                        </p>
                        <span className="text-sm tabular-nums">
                          {formatEuro(d.bedrag)}
                        </span>
                      </div>
                      <Cijfers b={d} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <div className="border-border bg-surface-2/60 space-y-1 border-t px-5 py-4 text-sm sm:px-6">
        <p className="flex justify-between gap-3 font-semibold">
          <span>Totale financiering</span>
          <span className="tabular-nums">{formatEuro(totaal)}</span>
        </p>
        <p className="text-muted text-xs">
          Bouwdepot en overige hypotheekruimte zijn delen van de hypotheek en
          tellen niet extra mee.
          {betaaldZonderBron > 0 &&
            ` ${formatEuro(betaaldZonderBron)} is betaald zonder bron.`}
        </p>
      </div>
    </Card>
  );
}

/** Bouwdepot: stand, looptijd en declaraties. */
export function DepotKaart({
  depot,
  magBewerken,
}: {
  depot: DepotWeergave;
  magBewerken: boolean;
}) {
  const { stand } = depot;
  const segmenten = [
    { label: "Uitbetaald", bedrag: stand.uitbetaald, kleur: "bg-accent" },
    { label: "Ingediend", bedrag: stand.ingediend, kleur: "bg-gold" },
    { label: "Concept", bedrag: stand.concept, kleur: "bg-gold/40" },
  ];
  const deel = (n: number) =>
    depot.bedrag > 0 ? Math.max(0, (n / depot.bedrag) * 100) : 0;
  const verloopt = depot.dagenTotEinde;
  return (
    <Card aria-labelledby={`depot-${depot.id}`} className="overflow-hidden">
      <CardHeader
        id={`depot-${depot.id}`}
        title="Bouwdepot"
        description={`Deel van ${depot.hypotheek}. De bank betaalt hieruit na een declaratie.`}
        action={
          magBewerken && (
            <Link
              href={`/financiering/declaraties/nieuw?depot=${depot.id}`}
              className={knopKlassen("primair", "px-3 py-2")}
            >
              <Plus className="size-4" />
              Declaratie maken
            </Link>
          )
        }
        className="pb-4"
      />
      <div className="space-y-3 px-5 pb-5 sm:px-6">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Bouwdepot", depot.bedrag],
            ["Uitbetaald", stand.uitbetaald],
            ["Gedeclareerd", stand.ingediend + stand.concept],
            ["Nog vrij", stand.vrij],
          ].map(([label, bedrag]) => (
            <div key={label as string}>
              <dt className="text-muted text-xs">{label}</dt>
              <dd
                className={cn(
                  "font-semibold tabular-nums",
                  label === "Nog vrij" &&
                    (bedrag as number) < 0 &&
                    "text-critical",
                )}
              >
                {formatEuro(bedrag as number)}
              </dd>
            </div>
          ))}
        </dl>
        <div
          role="img"
          aria-label={`Bouwdepot: ${formatEuro(stand.uitbetaald)} uitbetaald, ${formatEuro(stand.ingediend)} ingediend, ${formatEuro(stand.concept)} in concept, ${formatEuro(stand.vrij)} vrij`}
          className="bg-surface-2 flex h-2.5 w-full overflow-hidden rounded-full"
        >
          {segmenten.map((s) =>
            s.bedrag > 0 ? (
              <div
                key={s.label}
                className={s.kleur}
                style={{ width: `${deel(s.bedrag)}%` }}
              />
            ) : null,
          )}
        </div>
        <p className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {segmenten.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", s.kleur)} />
              {s.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-surface-2 border-border size-2 rounded-full border" />
            Vrij
          </span>
        </p>
        {verloopt !== null && verloopt <= 90 && (
          <p
            className={cn(
              "text-xs font-medium",
              verloopt < 0 ? "text-critical" : "text-warning",
            )}
          >
            {verloopt < 0
              ? `Het bouwdepot is verlopen op ${formatDatum(depot.eind!)}.`
              : `Het bouwdepot loopt over ${verloopt} ${verloopt === 1 ? "dag" : "dagen"} af (${formatDatum(depot.eind!)}).`}
          </p>
        )}
      </div>
      <h3 className="border-border text-muted border-t px-5 pt-4 pb-2 text-xs font-semibold tracking-wide uppercase sm:px-6">
        Declaraties
      </h3>
      {depot.declaraties.length ? (
        <ul>
          {depot.declaraties.map((c) => {
            const s = STATUS_DECLARATIE[c.status];
            return (
              <li key={c.id} className="border-border border-t">
                <Link
                  href={`/financiering/declaraties/${c.id}`}
                  className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      Declaratie {c.nummer ?? "zonder nummer"}
                    </p>
                    <p className="text-muted truncate text-xs">
                      {[
                        `${c.regels.length} ${c.regels.length === 1 ? "factuur" : "facturen"}`,
                        c.uitbetaaldOp
                          ? `uitbetaald ${formatDatum(c.uitbetaaldOp)}`
                          : c.ingediendOp &&
                            `ingediend ${formatDatum(c.ingediendOp)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium tabular-nums">
                      {formatEuro(c.bedrag)}
                    </span>
                    <StatusPill soort={s.soort}>{s.tekst}</StatusPill>
                  </div>
                  <ChevronRight className="text-subtle size-4 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted px-5 pb-5 text-sm sm:px-6">
          Nog geen declaraties. Kies de facturen die je bij de bank indient; na
          de uitbetaling legt de app de betalingen uit het bouwdepot vast.
        </p>
      )}
    </Card>
  );
}
