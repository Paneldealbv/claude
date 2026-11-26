"use client";

import { CircleCheck, Loader2, TriangleExclamationPoint } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

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
  const foutId = fout ? `${naam}-fout` : undefined;
  const hintId = hint ? `${naam}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={naam} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={naam}
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

const knopStijl = {
  primair:
    "bg-accent text-accent-foreground hover:bg-accent-hover shadow-[0_1px_0_rgb(255_255_255/0.15)_inset]",
  goud: "bg-gold text-gold-foreground hover:bg-gold-hover",
  secundair:
    "border border-border-strong bg-surface text-foreground hover:bg-surface-2",
  gevaar:
    "border border-border-strong bg-surface text-critical hover:bg-critical-soft",
  stil: "text-muted hover:bg-surface-2 hover:text-foreground",
} as const;

export function knopKlassen(
  variant: keyof typeof knopStijl = "primair",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    knopStijl[variant],
    className,
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
  variant?: keyof typeof knopStijl;
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
