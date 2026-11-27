import type { Metadata } from "next";
import Link from "next/link";
import { knopKlassen } from "@/components/ui/knop";

export const metadata: Metadata = { title: "Niet gevonden" };

/** Pagina of gegevens bestaan niet (of je hebt er geen toegang toe). */
export default function NietGevonden() {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-accent-ink text-sm font-semibold">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Niet gevonden
        </h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Deze pagina bestaat niet, of hoort bij een project waar je geen
          toegang toe hebt.
        </p>
        <Link href="/dashboard" className={knopKlassen("primair", "mt-6")}>
          Naar het dashboard
        </Link>
      </div>
    </main>
  );
}
