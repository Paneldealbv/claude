"use client";

import { Printer } from "lucide-react";
import { knopKlassen } from "@/components/ui/knop";

/** Afdrukken of opslaan als PDF via het afdrukvenster van de browser. */
export function AfdrukKnop() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={knopKlassen("secundair", "px-3 py-2")}
      title="Afdrukken of opslaan als PDF"
    >
      <Printer className="size-4" />
      PDF
    </button>
  );
}
