import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatEuro } from "@/lib/format";

/** KPI-tegel: label, waarde, toelichting en optioneel een meter of status. */
export function KpiCard({
  label,
  waarde,
  toelichting,
  status,
  meter,
}: {
  label: string;
  waarde: number;
  toelichting?: ReactNode;
  status?: ReactNode;
  meter?: { aandeel: number; label: string };
}) {
  return (
    <Card as="div" className="flex flex-col p-5">
      <p className="text-muted text-sm">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight whitespace-nowrap">
        {formatEuro(waarde, { centen: false })}
      </p>
      {meter && (
        <div className="mt-3">
          <div
            role="meter"
            aria-label={meter.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(meter.aandeel * 100)}
            className="bg-accent-soft h-1.5 overflow-hidden rounded-full"
          >
            <div
              className="bg-series-1 h-full rounded-full"
              style={{ width: `${Math.min(1, meter.aandeel) * 100}%` }}
            />
          </div>
        </div>
      )}
      {(toelichting || status) && (
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-3">
          {status}
          {toelichting && (
            <span className="text-muted text-xs">{toelichting}</span>
          )}
        </div>
      )}
    </Card>
  );
}

/** Het ene hoofdgetal van het dashboard: de financiële ruimte. */
export function HeroRuimte({
  ruimte,
  financiering,
  prognose,
}: {
  ruimte: number;
  financiering: number;
  prognose: number;
}) {
  const aandeel = prognose / financiering;
  const positief = ruimte >= 0;

  return (
    <Card
      as="div"
      className="relative flex flex-col overflow-hidden p-6 sm:p-7"
      aria-labelledby="ruimte-label"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)",
        }}
      />
      <p id="ruimte-label" className="text-muted relative text-sm font-medium">
        Financiële ruimte
      </p>
      <p
        className={cn(
          "relative mt-2 text-5xl font-semibold tracking-tight whitespace-nowrap sm:text-[56px] sm:leading-none",
          !positief && "text-critical",
        )}
      >
        {formatEuro(ruimte, { centen: false })}
      </p>
      <p className="text-muted relative mt-3 max-w-sm text-sm leading-relaxed">
        {positief
          ? "Verwacht over na alle kosten, op basis van de huidige prognose."
          : "Verwacht tekort na alle kosten, op basis van de huidige prognose."}
      </p>

      <div className="relative mt-auto pt-6">
        <div
          role="meter"
          aria-label="Prognose als deel van de totale financiering"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(aandeel * 100)}
          className="bg-accent-soft h-2 overflow-hidden rounded-full"
        >
          <div
            className={cn(
              "h-full rounded-full",
              positief ? "bg-series-1" : "bg-critical",
            )}
            style={{ width: `${Math.min(1, aandeel) * 100}%` }}
          />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted text-xs">Totale financiering</dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {formatEuro(financiering, { centen: false })}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-muted text-xs">Prognose eindkosten</dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {formatEuro(prognose, { centen: false })}
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
