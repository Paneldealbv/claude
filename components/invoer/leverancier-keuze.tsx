"use client";

import { useId, useState } from "react";
import { Veld } from "@/components/ui/form";

const NIEUW = "__nieuw__";

/** Leverancier kiezen, of meteen een nieuwe aanmaken met alleen een naam. */
export function LeverancierKeuze({
  leveranciers,
  standaard,
  fout,
}: {
  leveranciers: { id: string; naam: string }[];
  standaard?: string | null;
  fout?: string;
}) {
  const id = useId();
  const [keuze, setKeuze] = useState(
    standaard ?? (leveranciers.length ? "" : NIEUW),
  );
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={id} className="block text-sm font-medium">
          Leverancier
        </label>
        <select
          id={id}
          name="leverancierId"
          value={keuze}
          onChange={(e) => setKeuze(e.target.value)}
          className="border-border-strong bg-surface focus:border-accent focus:ring-accent/15 block w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none focus:ring-4"
        >
          <option value="">Geen leverancier</option>
          {leveranciers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.naam}
            </option>
          ))}
          <option value={NIEUW}>+ Nieuwe leverancier…</option>
        </select>
      </div>
      {keuze === NIEUW && (
        <Veld
          label="Naam nieuwe leverancier"
          naam="nieuweLeverancier"
          autoComplete="organization"
          fout={fout}
        />
      )}
    </div>
  );
}
