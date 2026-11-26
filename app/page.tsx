import { formatDatum, formatEuro } from "@/lib/format";

const voorbeelden = [
  { label: "Budget", waarde: formatEuro(42500000) },
  { label: "Prognose", waarde: formatEuro(43120050) },
  { label: "Betaald", waarde: formatEuro(18765432) },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-4 py-16 sm:px-6">
      <header className="space-y-3">
        <p className="text-accent text-sm font-medium tracking-wide uppercase">
          Stap 0 · Basisapplicatie
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Nieuwbouw Dashboard
        </h1>
        <p className="text-muted max-w-xl text-base">
          Budgetten, offertes, facturen en bonnetjes van onze nieuwbouwwoning op
          één plek. Inloggen en de eerste schermen volgen in de volgende
          stappen.
        </p>
      </header>

      <section
        aria-label="Voorbeeld van de opmaak"
        className="grid gap-3 sm:grid-cols-3"
      >
        {voorbeelden.map((v) => (
          <div
            key={v.label}
            className="border-border bg-card rounded-xl border p-4 shadow-sm"
          >
            <p className="text-muted text-sm">{v.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {v.waarde}
            </p>
          </div>
        ))}
      </section>

      <p className="text-muted text-sm">
        Voorbeeldbedragen ter controle van de opmaak ·{" "}
        {formatDatum("2026-11-26")}
      </p>
    </main>
  );
}
