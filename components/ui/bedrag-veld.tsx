"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatBedragInvoer, parseEuro } from "@/lib/format";

/**
 * Bedragveld in Nederlandse notatie ("24.000", "1.234,56", "12,5").
 * Bij het verlaten van het veld wordt het netjes getoond ("24.000,00").
 * Naar de server gaat een verborgen veld met hele centen, of "ongeldig".
 */
export function BedragVeld({
  label,
  naam,
  defaultValue,
  fout,
  hint,
  className,
  negatiefToegestaan = false,
  disabled,
  onWaarde,
}: {
  label: string;
  naam: string;
  /** In centen. */
  defaultValue?: number | null;
  fout?: string;
  hint?: ReactNode;
  className?: string;
  negatiefToegestaan?: boolean;
  disabled?: boolean;
  /** Meldt het bedrag in centen (of null) bij elke wijziging. */
  onWaarde?: (centen: number | null) => void;
}) {
  const id = useId();
  const [tekst, setTekst] = useState(
    defaultValue === null || defaultValue === undefined
      ? ""
      : formatBedragInvoer(defaultValue),
  );
  const [verlaten, setVerlaten] = useState(false);

  const centen = parseEuro(tekst);
  const leeg = tekst.trim() === "";
  const geldig = centen !== null && (negatiefToegestaan || centen >= 0);
  const waarde = leeg ? "" : geldig ? String(centen) : "ongeldig";
  const lokaleFout =
    verlaten && !leeg && !geldig
      ? centen !== null && centen < 0
        ? "Vul een positief bedrag in."
        : "Vul een bedrag in, bijvoorbeeld 1.250,00."
      : undefined;
  const getoondeFout = lokaleFout ?? fout;
  const foutId = getoondeFout ? `${id}-fout` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <span className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px]">
          €
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={tekst}
          disabled={disabled}
          onChange={(e) => {
            setTekst(e.target.value);
            onWaarde?.(parseEuro(e.target.value));
          }}
          onBlur={() => {
            setVerlaten(true);
            if (geldig && centen !== null) setTekst(formatBedragInvoer(centen));
          }}
          aria-invalid={getoondeFout ? true : undefined}
          aria-describedby={
            [foutId, hintId].filter(Boolean).join(" ") || undefined
          }
          className={cn(
            "border-border-strong bg-surface placeholder:text-subtle block w-full rounded-xl border py-2.5 pr-3.5 pl-8 text-right text-[15px] tabular-nums shadow-[0_1px_0_rgb(0_0_0/0.02)] transition-colors outline-none",
            "focus:border-accent focus:ring-accent/15 focus:ring-4",
            getoondeFout &&
              "border-critical focus:border-critical focus:ring-critical/15",
          )}
        />
      </div>
      <input type="hidden" name={naam} value={waarde} />
      {hint && !getoondeFout && (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      )}
      {getoondeFout && (
        <p id={foutId} className="text-critical text-xs font-medium">
          {getoondeFout}
        </p>
      )}
    </div>
  );
}
