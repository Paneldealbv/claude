"use client";

import { Check, ChevronsUpDown, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { uitloggen } from "@/app/(auth)/acties";
import { wisselProject } from "@/lib/acties/project";
import { cn } from "@/lib/cn";
import { formatDatum } from "@/lib/format";
import { AddDocumentButton } from "./add-document";
import { isActive, navGroups, settingsItem, type NavItem } from "./nav-items";
import { useShell } from "./shell-context";
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
  const badge = useShell().badges[item.href] ?? item.badge;
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
      {badge ? (
        <span className="bg-gold/15 text-gold rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Projectnaam met keuzelijst om van project te wisselen. */
function ProjectKiezer() {
  const { project, projecten } = useShell();
  return (
    <details className="group/kiezer relative">
      <summary className="border-sidebar-border hover:bg-sidebar-hover flex w-full cursor-pointer list-none items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="text-sidebar-foreground block truncate text-sm font-medium">
            {project.naam}
          </span>
          <span className="text-sidebar-muted block text-xs">
            {project.oplevering
              ? `Oplevering ${formatDatum(project.oplevering)}`
              : "Oplevering nog niet ingevuld"}
          </span>
        </span>
        <ChevronsUpDown className="text-sidebar-muted size-4 shrink-0" />
      </summary>
      <div className="border-sidebar-border bg-sidebar-hover shadow-pop absolute inset-x-0 top-full z-40 mt-1.5 rounded-xl border p-1.5">
        <p className="text-sidebar-muted px-2.5 pt-1 pb-1.5 text-[11px] font-medium tracking-wider uppercase">
          Projecten
        </p>
        {projecten.map((p) => (
          <form key={p.id} action={wisselProject}>
            <input type="hidden" name="projectId" value={p.id} />
            <button
              type="submit"
              className="text-sidebar-foreground hover:bg-sidebar-active flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{p.naam}</span>
              {p.id === project.id && <Check className="text-gold size-4" />}
            </button>
          </form>
        ))}
        <Link
          href="/welkom"
          className="text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm"
        >
          <Plus className="size-4" />
          Nieuw project
        </Link>
      </div>
    </details>
  );
}

/** Ingelogde gebruiker, projectleden, thema en uitloggen. */
function GebruikerBalk() {
  const { gebruiker, leden } = useShell();
  const anderen = leden.filter((l) => l.naam !== gebruiker.naam).slice(0, 3);
  return (
    <div className="space-y-3 px-3">
      <div className="flex items-center gap-2.5">
        <span className="bg-gold/20 text-gold flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
          {gebruiker.initialen}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sidebar-foreground truncate text-sm font-medium">
            {gebruiker.naam}
          </p>
          <p className="text-sidebar-muted truncate text-xs">
            {gebruiker.email}
          </p>
        </div>
        <form action={uitloggen}>
          <button
            type="submit"
            title="Uitloggen"
            className="text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground rounded-lg p-2"
          >
            <LogOut className="size-4" />
            <span className="sr-only">Uitloggen</span>
          </button>
        </form>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex -space-x-1.5"
          role="group"
          aria-label="Projectleden"
        >
          {anderen.map((l) => (
            <span
              key={l.naam}
              title={`${l.naam} · ${l.rol}`}
              className="bg-sidebar-active text-sidebar-foreground ring-sidebar flex size-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2"
            >
              {l.initialen}
            </span>
          ))}
        </div>
        <ThemeToggle />
      </div>
    </div>
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
        <ProjectKiezer />
      </div>

      <div className="px-3 pt-4">
        <AddDocumentButton voorOpenen={onNavigate} />
      </div>

      <nav aria-label="Hoofdmenu" className="mt-4 flex-1 overflow-y-auto px-3">
        {navGroups.map((g, i) => (
          <div key={g.label ?? i} className={cn(i > 0 && "mt-5")}>
            {g.label && (
              <p className="text-sidebar-muted mb-1.5 px-3 text-[11px] font-medium tracking-wider uppercase">
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
        <GebruikerBalk />
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="bg-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 lg:block print:hidden">
      <SidebarContent />
    </aside>
  );
}
