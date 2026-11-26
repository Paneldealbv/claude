import { Card, CardHeader } from "@/components/ui/card";
import { formatEuro } from "@/lib/format";
import type { demoFinanciering } from "@/lib/demo/data";

const heel = { centen: false } as const;

type Financiering = typeof demoFinanciering;

/**
 * Samenstelling van de financiering. De hypotheek is één bron; bouwdepot en
 * overige hypotheekruimte zijn delen daarvan (accolade boven de balk).
 */
export function FinancieringKaart({ data }: { data: Financiering }) {
  const hypotheek = data.hoofdbronnen.find((b) => b.id === "hypotheek")!;
  const overigeBronnen = data.hoofdbronnen.filter((b) => b.id !== "hypotheek");
  const totaal = data.hoofdbronnen.reduce((t, b) => t + b.bedrag, 0);
  const depot = hypotheek.delen.find((d) => d.id === "bouwdepot")!;
  const depotRest = depot.bedrag - depot.opgenomen;

  const segmenten = [
    ...hypotheek.delen.map((d, i) => ({
      id: d.id,
      naam: d.naam,
      bedrag: d.bedrag,
      kleur: i === 0 ? "var(--series-1)" : "var(--series-2)",
    })),
    ...overigeBronnen.map((b) => ({
      id: b.id,
      naam: b.naam,
      bedrag: b.bedrag,
      kleur: "var(--series-3)",
    })),
  ];
  const hypotheekAandeel = hypotheek.bedrag / totaal;

  return (
    <Card aria-labelledby="financiering-titel" className="flex flex-col">
      <CardHeader
        id="financiering-titel"
        title="Financiering"
        description="Bouwdepot is onderdeel van de hypotheek"
      />

      <div className="px-5 pt-5 sm:px-6">
        <p className="text-muted text-xs">Totale financiering</p>
        <p className="text-2xl font-semibold tracking-tight">
          {formatEuro(totaal, heel)}
        </p>

        {/* Accolade: welke delen samen de hypotheek vormen */}
        <div
          className="mt-5 flex items-end"
          style={{ width: `${hypotheekAandeel * 100}%` }}
        >
          <div className="w-full">
            <p className="text-muted mb-1 text-center text-xs">
              Hypotheek{" "}
              <span className="text-foreground font-medium tabular-nums">
                {formatEuro(hypotheek.bedrag, heel)}
              </span>
            </p>
            <div className="border-border-strong h-2 rounded-t-md border-x border-t" />
          </div>
        </div>

        <div
          className="mt-1 flex h-7 gap-0.5"
          role="img"
          aria-label={segmenten
            .map((s) => `${s.naam} ${formatEuro(s.bedrag, heel)}`)
            .join(", ")}
        >
          {segmenten.map((s) => (
            <div
              key={s.id}
              className="rounded"
              style={{
                flexGrow: s.bedrag,
                flexBasis: 0,
                background: s.kleur,
              }}
              title={`${s.naam}: ${formatEuro(s.bedrag, heel)}`}
            />
          ))}
        </div>

        <ul className="mt-4 space-y-2 text-sm">
          {segmenten.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: s.kleur }}
              />
              <span className="flex-1">
                {s.naam}
                {s.id !== "eigen-geld" && (
                  <span className="text-subtle"> · deel hypotheek</span>
                )}
              </span>
              <span className="font-medium tabular-nums">
                {formatEuro(s.bedrag, heel)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-border mx-5 mt-5 mb-5 rounded-xl border p-4 sm:mx-6">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">Bouwdepot</p>
          <p className="text-muted text-xs">
            nog{" "}
            <span className="text-foreground font-semibold">
              {formatEuro(depotRest, heel)}
            </span>{" "}
            beschikbaar
          </p>
        </div>
        <div
          role="meter"
          aria-label="Opgenomen uit bouwdepot"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((depot.opgenomen / depot.bedrag) * 100)}
          className="bg-surface-3 mt-3 h-2 overflow-hidden rounded-full"
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${(depot.opgenomen / depot.bedrag) * 100}%`,
              background: "var(--series-2)",
            }}
          />
        </div>
        <p className="text-muted mt-2 text-xs tabular-nums">
          {formatEuro(depot.opgenomen, heel)} opgenomen van{" "}
          {formatEuro(depot.bedrag, heel)}
        </p>
      </div>
    </Card>
  );
}
