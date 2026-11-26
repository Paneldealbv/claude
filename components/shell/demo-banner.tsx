import { FlaskConical } from "lucide-react";

/** Duidelijke melding dat de getoonde cijfers verzonnen zijn. */
export function DemoBanner() {
  return (
    <div
      role="note"
      className="border-demo-border bg-demo-soft text-demo flex items-start gap-2.5 rounded-xl border px-4 py-2.5 text-sm"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0" />
      <p>
        <strong className="font-semibold">Demo-gegevens.</strong> Alle namen,
        bedragen en documenten op deze pagina zijn verzonnen en dienen alleen om
        het ontwerp te beoordelen.
      </p>
    </div>
  );
}
