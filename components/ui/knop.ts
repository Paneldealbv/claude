import { cn } from "@/lib/cn";

/*
 * Knopstijlen. Bewust géén "use client": ook Server Components gebruiken
 * deze klassen (bijv. voor links die eruitzien als knoppen).
 */
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

export type KnopVariant = keyof typeof knopStijl;
