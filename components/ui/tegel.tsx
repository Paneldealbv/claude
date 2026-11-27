import { cn } from "@/lib/cn";

/** Kerncijfer bovenaan een pagina (label, bedrag, toelichting). */
export function Tegel({
  label,
  waarde,
  extra,
  kritiek,
  positief,
}: {
  label: string;
  waarde: string;
  extra?: string;
  kritiek?: boolean;
  positief?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border bg-surface shadow-card rounded-2xl border p-4",
        kritiek && "border-critical/40",
      )}
    >
      <p className="text-muted text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight whitespace-nowrap",
          kritiek && "text-critical",
          positief && "text-positive",
        )}
      >
        {waarde}
      </p>
      {extra && <p className="text-muted mt-1 text-xs">{extra}</p>}
    </div>
  );
}
