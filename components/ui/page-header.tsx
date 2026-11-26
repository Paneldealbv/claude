import type { ReactNode } from "react";

export function PageHeader({
  titel,
  omschrijving,
  actie,
}: {
  titel: string;
  omschrijving?: ReactNode;
  actie?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
          {titel}
        </h1>
        {omschrijving && (
          <p className="text-muted mt-1 text-sm">{omschrijving}</p>
        )}
      </div>
      {actie}
    </div>
  );
}
