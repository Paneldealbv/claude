"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { THEMA_OPSLAG as OPSLAG } from "@/lib/thema";

type Thema = "systeem" | "licht" | "donker";

const luisteraars = new Set<() => void>();

function leesThema(): Thema {
  try {
    const t = localStorage.getItem(OPSLAG);
    return t === "licht" || t === "donker" ? t : "systeem";
  } catch {
    return "systeem";
  }
}

function zetThema(t: Thema) {
  try {
    if (t === "systeem") localStorage.removeItem(OPSLAG);
    else localStorage.setItem(OPSLAG, t);
  } catch {
    // Opslag geblokkeerd: keuze geldt alleen voor deze pagina.
  }
  const root = document.documentElement;
  if (t === "licht") root.dataset.theme = "light";
  else if (t === "donker") root.dataset.theme = "dark";
  else delete root.dataset.theme;
  luisteraars.forEach((l) => l());
}

function abonneer(l: () => void) {
  luisteraars.add(l);
  return () => luisteraars.delete(l);
}

const opties: { waarde: Thema; label: string; icon: typeof Sun }[] = [
  { waarde: "licht", label: "Licht", icon: Sun },
  { waarde: "donker", label: "Donker", icon: Moon },
  { waarde: "systeem", label: "Systeem", icon: Monitor },
];

export function ThemeToggle({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "surface";
}) {
  const huidig = useSyncExternalStore(abonneer, leesThema, () => "systeem");

  return (
    <div
      role="radiogroup"
      aria-label="Thema"
      className={cn(
        "flex items-center gap-0.5 rounded-lg p-0.5",
        variant === "sidebar" ? "bg-sidebar-hover" : "bg-surface-2",
      )}
    >
      {opties.map((o) => {
        const actief = huidig === o.waarde;
        return (
          <button
            key={o.waarde}
            type="button"
            role="radio"
            aria-checked={actief}
            title={o.label}
            onClick={() => zetThema(o.waarde)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              variant === "sidebar"
                ? actief
                  ? "bg-sidebar-active text-sidebar-foreground"
                  : "text-sidebar-muted hover:text-sidebar-foreground"
                : actief
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted hover:text-foreground",
            )}
          >
            <o.icon className="size-3.5" />
            <span className="sr-only">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
