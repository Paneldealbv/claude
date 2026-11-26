"use client";

import { CircleCheck, Loader2, TriangleExclamationPoint } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";
import { knopKlassen, type KnopVariant } from "./knop";

export function Veld({
  label,
  naam,
  fout,
  hint,
  className,
  ...input
}: {
  label: string;
  naam: string;
  fout?: string;
  hint?: ReactNode;
} & Omit<ComponentProps<"input">, "name" | "id">) {
  // Uniek id per veld: meerdere formulieren op één pagina kunnen dezelfde
  // veldnaam hebben (bijv. "naam"), maar een label moet bij zijn eigen veld horen.
  const id = useId();
  const foutId = fout ? `${id}-fout` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={naam}
        aria-invalid={fout ? true : undefined}
        aria-describedby={
          [foutId, hintId].filter(Boolean).join(" ") || undefined
        }
        className={cn(
          "border-border-strong bg-surface placeholder:text-subtle block w-full rounded-xl border px-3.5 py-2.5 text-[15px] shadow-[0_1px_0_rgb(0_0_0/0.02)] transition-colors outline-none",
          "focus:border-accent focus:ring-accent/15 focus:ring-4",
          fout &&
            "border-critical focus:border-critical focus:ring-critical/15",
        )}
        {...input}
      />
      {hint && !fout && (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      )}
      {fout && (
        <p id={foutId} className="text-critical text-xs font-medium">
          {fout}
        </p>
      )}
    </div>
  );
}

/** Verzendknop die zichzelf uitschakelt tijdens het versturen. */
export function VerzendKnop({
  children,
  bezigTekst,
  variant = "primair",
  className,
  ...rest
}: {
  children: ReactNode;
  bezigTekst?: string;
  variant?: KnopVariant;
} & ComponentProps<"button">) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      aria-busy={pending || undefined}
      className={knopKlassen(variant, className)}
      {...rest}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && bezigTekst ? bezigTekst : children}
    </button>
  );
}

export function Melding({
  soort,
  children,
}: {
  soort: "fout" | "succes";
  children: ReactNode;
}) {
  const Icon = soort === "fout" ? TriangleExclamationPoint : CircleCheck;
  return (
    <div
      role={soort === "fout" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm",
        soort === "fout"
          ? "bg-critical-soft text-critical"
          : "bg-positive-soft text-positive",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
