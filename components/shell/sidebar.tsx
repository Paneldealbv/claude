"use client";

import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatDatum } from "@/lib/format";
import { demoProject } from "@/lib/demo/data";
import { AddDocumentButton } from "./add-document";
import { isActive, navGroups, settingsItem, type NavItem } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="9" fill="var(--gold)" />
      <path
        d="M9 15.2 16 9.5l7 5.7V23a1 1 0 0 1-1 1h-4v-5h-4v5h-4a1 1 0 0 1-1-1z"
        fill="var(--gold-foreground)"
      />
    </svg>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const actief = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={actief ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        actief
          ? "bg-sidebar-active text-sidebar-foreground font-medium"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground",
      )}
    >
      {actief && (
        <span className="bg-gold absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
      )}
      <item.icon
        className={cn(
          "size-[18px] shrink-0",
          actief ? "text-gold" : "text-sidebar-muted",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="bg-gold/15 text-gold rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Inhoud van de zijbalk; ook gebruikt in de mobiele lade. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <Logo />
        <div className="min-w-0">
          <p className="text-sidebar-foreground truncate text-[15px] font-semibold tracking-tight">
            Nieuwbouw
          </p>
          <p className="text-sidebar-muted text-xs">Dashboard</p>
        </div>
      </div>

      <div className="px-3">
        <button
          type="button"
          className="border-sidebar-border hover:bg-sidebar-hover flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
          title="Projecten wisselen (later)"
        >
          <span className="min-w-0 flex-1">
            <span className="text-sidebar-foreground block truncate text-sm font-medium">
              {demoProject.naam}
            </span>
            <span className="text-sidebar-muted block text-xs">
              Oplevering {formatDatum(demoProject.oplevering)}
            </span>
          </span>
          <ChevronsUpDown className="text-sidebar-muted size-4 shrink-0" />
        </button>
      </div>

      <div className="px-3 pt-4">
        <AddDocumentButton voorOpenen={onNavigate} />
      </div>

      <nav aria-label="Hoofdmenu" className="mt-4 flex-1 overflow-y-auto px-3">
        {navGroups.map((g, i) => (
          <div key={g.label ?? i} className={cn(i > 0 && "mt-5")}>
            {g.label && (
              <p className="text-sidebar-muted/70 mb-1.5 px-3 text-[11px] font-medium tracking-wider uppercase">
                {g.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    pathname={pathname}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-sidebar-border mt-4 space-y-3 border-t px-3 pt-3 pb-4">
        <NavLink
          item={settingsItem}
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <div className="flex items-center justify-between gap-2 px-3">
          <div className="flex -space-x-1.5">
            {demoProject.gebruikers.map((g) => (
              <span
                key={g.naam}
                title={`${g.naam} · ${g.rol}`}
                className="bg-sidebar-active text-sidebar-foreground ring-sidebar flex size-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2"
              >
                {g.initialen}
              </span>
            ))}
          </div>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="bg-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
      <SidebarContent />
    </aside>
  );
}
