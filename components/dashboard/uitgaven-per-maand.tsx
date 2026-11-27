"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useSyncExternalStore } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { formatEuro, formatEuroKort } from "@/lib/format";

type Punt = { maand: string; label: string; betaald: number };
type Rij = Punt & { cumulatief: number; naam: string };

const maandnamen = new Intl.DateTimeFormat("nl-NL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function MaandTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload as Rij;
  return (
    <div className="border-border bg-surface shadow-pop rounded-xl border px-3 py-2.5 text-xs">
      <p className="mb-1.5 text-sm font-semibold first-letter:uppercase">
        {r.naam}
      </p>
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        <dt className="text-muted flex items-center gap-1.5">
          <span className="bg-series-1 size-2 rounded-sm" />
          Betaald
        </dt>
        <dd className="text-right font-medium">{formatEuro(r.betaald)}</dd>
        <dt className="text-muted pl-3.5">Cumulatief</dt>
        <dd className="text-right">{formatEuro(r.cumulatief)}</dd>
      </dl>
    </div>
  );
}

const geenAbonnement = () => () => {};

/** Recharts maakt willekeurige id's aan; daarom alleen in de browser tekenen. */
function useInBrowser() {
  return useSyncExternalStore(
    geenAbonnement,
    () => true,
    () => false,
  );
}

export function UitgavenPerMaand({ data }: { data: Punt[] }) {
  const inBrowser = useInBrowser();
  const rijen: Rij[] = data.map((d, i) => ({
    ...d,
    cumulatief: data.slice(0, i + 1).reduce((t, x) => t + x.betaald, 0),
    naam: maandnamen.format(new Date(`${d.maand}-01T00:00:00Z`)),
  }));
  const totaal = rijen.at(-1)?.cumulatief ?? 0;
  const gemiddeld = data.length ? Math.round(totaal / data.length) : 0;

  if (!data.length) {
    return (
      <Card aria-labelledby="uitgaven-titel" className="flex flex-col">
        <CardHeader
          id="uitgaven-titel"
          title="Betaald per maand"
          description="Alle betalingen, inclusief BTW"
        />
        <p className="text-muted px-5 pt-3 pb-5 text-sm sm:px-6">
          Nog geen betalingen. Zodra je betalingen vastlegt bij een factuur of
          bon, zie je hier per maand wat er is betaald.
        </p>
      </Card>
    );
  }

  return (
    <Card aria-labelledby="uitgaven-titel" className="flex flex-col">
      <CardHeader
        id="uitgaven-titel"
        title="Betaald per maand"
        description="Alle betalingen, inclusief BTW"
      />
      <dl className="mt-4 flex gap-8 px-5 sm:px-6">
        <div>
          <dt className="text-muted text-xs">Totaal betaald</dt>
          <dd className="mt-0.5 text-lg font-semibold tracking-tight">
            {formatEuro(totaal, { centen: false })}
          </dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Gemiddeld per maand</dt>
          <dd className="mt-0.5 text-lg font-semibold tracking-tight">
            {formatEuro(gemiddeld, { centen: false })}
          </dd>
        </div>
      </dl>

      <div
        className="mt-4 h-60 px-2 pb-3 sm:px-4"
        role="img"
        aria-label={`Staafdiagram van betalingen per maand, ${rijen
          .map((r) => `${r.naam}: ${formatEuro(r.betaald, { centen: false })}`)
          .join("; ")}`}
      >
        {inBrowser ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 520, height: 240 }}
          >
            <BarChart
              data={rijen}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="28%"
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--grid)"
                strokeWidth={1}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "var(--axis)" }}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                dy={6}
              />
              <YAxis
                tickFormatter={(v: number) => formatEuroKort(v)}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                width={64}
                tickCount={4}
              />
              <Tooltip
                content={MaandTooltip}
                cursor={{ fill: "var(--surface-2)", radius: 6 }}
                isAnimationActive={false}
              />
              <Bar
                dataKey="betaald"
                name="Betaald"
                fill="var(--series-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="bg-surface-2 h-full animate-pulse rounded-xl" />
        )}
      </div>
    </Card>
  );
}
