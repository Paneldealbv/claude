"use client";

import { useId } from "react";
import { BTW_TARIEVEN } from "@/lib/btw";
import { cn } from "@/lib/cn";

export const keuzeKlassen =
  "border-border-strong bg-surface focus:border-accent focus:ring-accent/15 block w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none focus:ring-4";

/** Keuzelijst voor het BTW-tarief (basispunten). */
export function BtwKeuze({
  naam = "btw",
  label = "BTW",
  standaard = 2100,
  className,
}: {
  naam?: string;
  label?: string;
  standaard?: number;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={naam}
        defaultValue={standaard}
        className={keuzeKlassen}
      >
        {BTW_TARIEVEN.map((t) => (
          <option key={t.bp} value={t.bp}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Keuzelijst met eindcategorieën ("Ouder › Kind"). */
export function CategorieKeuze({
  categorieen,
  naam = "categorieId",
  label = "Categorie",
  standaard,
  fout,
  className,
}: {
  categorieen: { id: string; label: string }[];
  naam?: string;
  label?: string;
  standaard?: string | null;
  fout?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={naam}
        defaultValue={standaard ?? ""}
        aria-invalid={fout ? true : undefined}
        aria-describedby={fout ? `${id}-fout` : undefined}
        className={cn(keuzeKlassen, fout && "border-critical")}
      >
        <option value="" disabled>
          Kies een categorie
        </option>
        {categorieen.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      {fout && (
        <p id={`${id}-fout`} className="text-critical text-xs font-medium">
          {fout}
        </p>
      )}
    </div>
  );
}
