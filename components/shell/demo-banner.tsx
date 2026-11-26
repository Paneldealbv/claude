import { FlaskConical } from "lucide-react";
import Link from "next/link";

/** Duidelijke melding dat de getoonde cijfers verzonnen zijn. */
export function DemoBanner() {
  return (
    <div
      role="note"
      className="border-demo-border bg-demo-soft text-demo flex items-start gap-2.5 rounded-xl border px-4 py-2.5 text-sm"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0" />
      <p>
        <strong className="font-semibold">Demo-gegevens.</strong> De cijfers,
        namen en documenten op deze pagina zijn verzonnen en dienen alleen om
        het ontwerp te beoordelen. Je eigen{" "}
        <Link
          href="/budget"
          className="font-semibold underline underline-offset-2"
        >
          budget
        </Link>
        ,{" "}
        <Link
          href="/offertes"
          className="font-semibold underline underline-offset-2"
        >
          offertes
        </Link>{" "}
        en{" "}
        <Link
          href="/contracten"
          className="font-semibold underline underline-offset-2"
        >
          contracten
        </Link>{" "}
        beheer je al op hun eigen pagina; dit dashboard toont je echte cijfers
        zodra ook facturen en betalingen zijn ingevoerd.
      </p>
    </div>
  );
}
