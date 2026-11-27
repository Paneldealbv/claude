"use client";

import { useId, useState } from "react";
import { Veld } from "@/components/ui/form";
import { cn } from "@/lib/cn";

const NIEUW = "__nieuw__";

/** Gegevens voor een nieuwe leverancier, bijv. zoals de AI ze las. */
export type NieuweLeverancier = {
  naam: string;
  kvk?: string | null;
  iban?: string | null;
  btwNummer?: string | null;
};

/** Leverancier kiezen, of meteen een nieuwe aanmaken met alleen een naam. */
export function LeverancierKeuze({
  leveranciers,
  standaard,
  standaardNieuw,
  fout,
}: {
  leveranciers: { id: string; naam: string }[];
  standaard?: string | null;
  /** Voorstel voor een nieuwe leverancier (als er geen bestaande past). */
  standaardNieuw?: NieuweLeverancier | null;
  fout?: string;
}) {
  const id = useId();
  const [keuze, setKeuze] = useState(
    standaard ?? (standaardNieuw || !leveranciers.length ? NIEUW : ""),
  );
  const extra = standaardNieuw
    ? [
        standaardNieuw.kvk && `KvK ${standaardNieuw.kvk}`,
        standaardNieuw.iban && `IBAN ${standaardNieuw.iban}`,
        standaardNieuw.btwNummer && `BTW ${standaardNieuw.btwNummer}`,
      ].filter(Boolean)
    : [];
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
          aria-invalid={fout && keuze !== NIEUW ? true : undefined}
          className={cn(
            "border-border-strong bg-surface focus:border-accent focus:ring-accent/15 block w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none focus:ring-4",
            fout && keuze !== NIEUW && "border-critical",
          )}
        >
          <option value="">Geen leverancier</option>
          {leveranciers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.naam}
            </option>
          ))}
          <option value={NIEUW}>+ Nieuwe leverancier…</option>
        </select>
        {fout && keuze !== NIEUW && (
          <p className="text-critical text-xs font-medium">{fout}</p>
        )}
      </div>
      {keuze === NIEUW && (
        <>
          <Veld
            label="Naam nieuwe leverancier"
            naam="nieuweLeverancier"
            autoComplete="organization"
            defaultValue={standaardNieuw?.naam ?? ""}
            fout={fout}
            hint={
              extra.length
                ? `Van het document: ${extra.join(" · ")}. Wordt bij de leverancier bewaard.`
                : undefined
            }
          />
          {standaardNieuw?.kvk && (
            <input
              type="hidden"
              name="nieuweLeverancierKvk"
              value={standaardNieuw.kvk}
            />
          )}
          {standaardNieuw?.iban && (
            <input
              type="hidden"
              name="nieuweLeverancierIban"
              value={standaardNieuw.iban}
            />
          )}
          {standaardNieuw?.btwNummer && (
            <input
              type="hidden"
              name="nieuweLeverancierBtw"
              value={standaardNieuw.btwNummer}
            />
          )}
        </>
      )}
    </div>
  );
}
