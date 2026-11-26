import type { ReactNode } from "react";

export function AuthKop({
  titel,
  tekst,
}: {
  titel: string;
  tekst?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight">{titel}</h1>
      {tekst && <p className="text-muted mt-1.5 text-sm">{tekst}</p>}
    </div>
  );
}
