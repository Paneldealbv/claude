import { Card, CardHeader } from "@/components/ui/card";
import type { BronResultaat, FinancieringResultaat } from "@/lib/finance";
import { formatEuro } from "@/lib/format";

const heel = { centen: false } as const;

const KLEUR_DEEL: Partial<Record<BronResultaat["type"], string>> = {
  overige_hypotheekruimte: "var(--series-1)",
  bouwdepot: "var(--series-2)",
};

type Segment = {
  id: string;
  naam: string;
  bedrag: number;
  kleur: string;
  isDeel: boolean;
};

/**
 * Samenstelling van de financiering. De hypotheek is één bron; bouwdepot en
 * overige hypotheekruimte zijn delen daarvan (accolade boven de balk) en
 * tellen niet extra mee in het totaal.
 */
export function FinancieringKaart({ data }: { data: FinancieringResultaat }) {
  const totaal = data.totaalBeschikbaar;
  if (!data.bronnen.length) {
    return (
      <Card aria-labelledby="financiering-titel" className="flex flex-col">
        <CardHeader
          id="financiering-titel"
          title="Financiering"
          description="Eigen geld, hypotheek en bouwdepot"
        />
        <p className="text-muted px-5 pt-3 pb-5 text-sm sm:px-6">
          Nog geen financiering vastgelegd. Dat komt in fase 9; daarna zie je
          hier waaruit je betaalt en hoeveel er in het bouwdepot over is.
        </p>
      </Card>
    );
  }
  const hypotheek = data.bronnen.find(
    (b) => b.type === "hypotheek" && b.delen.length,
  );
  const depot = data.bronnen
    .flatMap((b) => b.delen)
    .find((d) => d.type === "bouwdepot");

  const segmenten = data.bronnen.flatMap((b): Segment[] =>
    b.delen.length
      ? b.delen.map((d) => ({
          id: d.id,
          naam: d.naam,
          bedrag: d.bedrag,
          kleur: KLEUR_DEEL[d.type] ?? "var(--series-1)",
          isDeel: true,
        }))
      : [
          {
            id: b.id,
            naam: b.naam,
            bedrag: b.bedrag,
            kleur: "var(--series-3)",
            isDeel: false,
          },
        ],
  );
  const hypotheekAandeel =
    hypotheek && totaal > 0 ? hypotheek.bedrag / totaal : 0;
  const depotAandeel =
    depot && depot.bedrag > 0 ? depot.betaald / depot.bedrag : 0;

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

        {hypotheek && (
          // Accolade: welke delen samen de hypotheek vormen
          <div
            className="mt-5 flex items-end"
            style={{ width: `${hypotheekAandeel * 100}%` }}
          >
            <div className="w-full">
              <p className="text-muted mb-1 text-center text-xs">
                {hypotheek.naam}{" "}
                <span className="text-foreground font-medium tabular-nums">
                  {formatEuro(hypotheek.bedrag, heel)}
                </span>
              </p>
              <div className="border-border-strong h-2 rounded-t-md border-x border-t" />
            </div>
          </div>
        )}

        <div
          className={
            hypotheek ? "mt-1 flex h-7 gap-0.5" : "mt-5 flex h-7 gap-0.5"
          }
          role="img"
          aria-label={segmenten
            .map((s) => `${s.naam} ${formatEuro(s.bedrag, heel)}`)
            .join(", ")}
        >
          {segmenten.map((s) => (
            <div
              key={s.id}
              className="rounded"
              style={{ flexGrow: s.bedrag, flexBasis: 0, background: s.kleur }}
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
                {s.isDeel && (
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

      {depot && (
        <div className="border-border mx-5 mt-5 mb-5 rounded-xl border p-4 sm:mx-6">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">{depot.naam}</p>
            <p className="text-muted text-xs">
              nog{" "}
              <span className="text-foreground font-semibold">
                {formatEuro(depot.saldo, heel)}
              </span>{" "}
              beschikbaar
            </p>
          </div>
          <div
            role="meter"
            aria-label="Opgenomen uit bouwdepot"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(depotAandeel * 100)}
            className="bg-surface-3 mt-3 h-2 overflow-hidden rounded-full"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(1, depotAandeel) * 100}%`,
                background: "var(--series-2)",
              }}
            />
          </div>
          <p className="text-muted mt-2 text-xs tabular-nums">
            {formatEuro(depot.betaald, heel)} opgenomen van{" "}
            {formatEuro(depot.bedrag, heel)}
          </p>
        </div>
      )}
    </Card>
  );
}
