"use client";

import { CalendarDays } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { isoNaarNl, parseDatum } from "@/lib/datum";

/**
 * Datumveld in de notatie DD-MM-JJJJ, ongeacht de taal van de browser.
 *
 * - De gebruiker typt vrij (15-5-2027, 15/05/27, 15052027 …); bij het
 *   verlaten van het veld wordt het netjes als 15-05-2027 getoond.
 * - Het kalenderknopje opent de kalender van het apparaat; de gekozen datum
 *   verschijnt als DD-MM-JJJJ.
 * - Naar de server gaat een verborgen veld met ISO (JJJJ-MM-DD), of
 *   "ongeldig" zodat de server een duidelijke foutmelding geeft.
 */
export function DatumVeld({
  label,
  naam,
  defaultValue,
  fout,
  hint,
  className,
  disabled,
}: {
  label: string;
  naam: string;
  /** ISO-datum (JJJJ-MM-DD) of leeg. */
  defaultValue?: string | null;
  fout?: string;
  hint?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const kalender = useRef<HTMLInputElement>(null);
  const [tekst, setTekst] = useState(isoNaarNl(defaultValue));
  const [verlaten, setVerlaten] = useState(false);

  const iso = parseDatum(tekst);
  const leeg = tekst.trim() === "";
  const waarde = leeg ? "" : (iso ?? "ongeldig");
  const lokaleFout =
    verlaten && !leeg && !iso
      ? "Gebruik DD-MM-JJJJ, bijvoorbeeld 15-05-2027."
      : undefined;
  const getoondeFout = lokaleFout ?? fout;
  const foutId = getoondeFout ? `${id}-fout` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  function openKalender() {
    const el = kalender.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      // Oudere browsers zonder showPicker: veld focussen en klikken.
      el.focus();
      el.click();
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD-MM-JJJJ"
          value={tekst}
          disabled={disabled}
          onChange={(e) => setTekst(e.target.value)}
          onBlur={() => {
            setVerlaten(true);
            if (iso) setTekst(isoNaarNl(iso));
          }}
          aria-invalid={getoondeFout ? true : undefined}
          aria-describedby={
            [foutId, hintId].filter(Boolean).join(" ") || undefined
          }
          className={cn(
            "border-border-strong bg-surface placeholder:text-subtle block w-full rounded-xl border py-2.5 pr-12 pl-3.5 text-[15px] tabular-nums shadow-[0_1px_0_rgb(0_0_0/0.02)] transition-colors outline-none",
            "focus:border-accent focus:ring-accent/15 focus:ring-4",
            getoondeFout &&
              "border-critical focus:border-critical focus:ring-critical/15",
          )}
        />
        <button
          type="button"
          onClick={openKalender}
          disabled={disabled}
          className="text-muted hover:bg-surface-2 hover:text-foreground absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg disabled:opacity-50"
        >
          <CalendarDays className="size-[18px]" />
          <span className="sr-only">Kies een datum in de kalender</span>
        </button>
        {/* Onzichtbaar maar aanwezig, zodat de kalender kan openen. */}
        <input
          ref={kalender}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          value={iso ?? ""}
          onChange={(e) => {
            if (e.target.value) {
              setTekst(isoNaarNl(e.target.value));
              setVerlaten(true);
            }
          }}
          className="pointer-events-none absolute right-0 bottom-0 size-px opacity-0"
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
