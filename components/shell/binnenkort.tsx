import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

/** Nette lege toestand voor onderdelen die in een latere fase komen. */
export function Binnenkort({
  titel,
  omschrijving,
  icon: Icon,
  fase,
  punten,
}: {
  titel: string;
  omschrijving: string;
  icon: LucideIcon;
  fase: string;
  punten: string[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader titel={titel} omschrijving={omschrijving} />
      <Card className="flex flex-col items-center px-6 py-14 text-center sm:py-20">
        <span className="bg-accent-soft text-accent-ink flex size-14 items-center justify-center rounded-2xl">
          <Icon className="size-6" />
        </span>
        <p className="text-subtle mt-5 text-xs font-medium tracking-wider uppercase">
          Wordt gebouwd in {fase}
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">
          {titel} komt hier
        </h2>
        <ul className="text-muted mt-4 max-w-md space-y-1.5 text-sm">
          {punten.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
