import {
  CircleCheck,
  CircleExclamationPoint,
  Clock,
  Copy,
  Info,
  type LucideIcon,
  TriangleExclamationPoint,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatusSoort =
  "positief" | "waarschuwing" | "kritiek" | "info" | "neutraal";

const stijl: Record<StatusSoort, string> = {
  positief: "bg-positive-soft text-positive",
  waarschuwing: "bg-warning-soft text-warning",
  kritiek: "bg-critical-soft text-critical",
  info: "bg-info-soft text-info",
  neutraal: "bg-surface-2 text-muted",
};

const icoon: Record<StatusSoort, LucideIcon> = {
  positief: CircleCheck,
  waarschuwing: Clock,
  kritiek: TriangleExclamationPoint,
  info: Info,
  neutraal: CircleExclamationPoint,
};

/**
 * Statuslabel: kleur gaat altijd samen met een icoon én tekst, zodat de
 * betekenis nooit alleen van kleur afhangt.
 */
export function StatusPill({
  soort,
  children,
  icon,
  className,
}: {
  soort: StatusSoort;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const Icon = icon ?? icoon[soort];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        stijl[soort],
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

export const DuplicaatIcon = Copy;
