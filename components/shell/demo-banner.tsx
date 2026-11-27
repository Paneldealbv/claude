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
        <strong className="font-semibold">Demo-gegevens.</strong> Een
        voorbeeldproject met verzonnen cijfers, namen en documenten, om te zien
        hoe het dashboard eruitziet bij een bouw in volle gang.{" "}
        <Link
          href="/dashboard"
          className="font-semibold underline underline-offset-2"
        >
          Terug naar jouw dashboard
        </Link>
      </p>
    </div>
  );
}
