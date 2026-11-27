"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Gegevens die de app-shell (zijbalk, menu) nodig heeft. */
export type ShellData = {
  project: {
    id: string;
    naam: string;
    oplevering: string | null;
    rol: "eigenaar" | "bewerker" | "lezer";
  };
  projecten: { id: string; naam: string }[];
  gebruiker: { naam: string; email: string; initialen: string };
  leden: { naam: string; initialen: string; rol: string }[];
  /** Aantallen bij een menu-item, per href (bijv. nog niet geboekt). */
  badges: Record<string, number>;
};

const ShellContext = createContext<ShellData | null>(null);

export function ShellProvider({
  data,
  children,
}: {
  data: ShellData;
  children: ReactNode;
}) {
  return <ShellContext value={data}>{children}</ShellContext>;
}

export function useShell() {
  const data = useContext(ShellContext);
  if (!data) throw new Error("useShell buiten ShellProvider");
  return data;
}
