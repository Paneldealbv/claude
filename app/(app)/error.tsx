"use client";

import { RotateCcw, TriangleExclamationPoint } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { knopKlassen } from "@/components/ui/knop";

/** Onverwachte fout op een pagina binnen de app. */
export default function Fout({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const code =
    error instanceof Error && "digest" in error
      ? String((error as Error & { digest?: string }).digest ?? "")
      : "";
  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <span className="bg-critical-soft text-critical mx-auto flex size-12 items-center justify-center rounded-full">
        <TriangleExclamationPoint className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold">Er ging iets mis</h1>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        Deze pagina kon niet worden geladen. Er is niets verloren gegaan:
        probeer het opnieuw. Blijft het misgaan, laat dan de foutcode weten.
      </p>
      {code && (
        <p className="text-muted mt-2 font-mono text-xs">Foutcode {code}</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className={knopKlassen("primair")}
        >
          <RotateCcw className="size-4" />
          Opnieuw proberen
        </button>
        <Link href="/dashboard" className={knopKlassen("secundair")}>
          Naar het dashboard
        </Link>
      </div>
    </div>
  );
}
