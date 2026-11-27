"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { AddDocumentFab } from "./add-document";
import { isActive, mobileTabs, type NavItem } from "./nav-items";
import { useShell } from "./shell-context";
import { Logo, SidebarContent } from "./sidebar";

/** Bovenbalk + lade met het volledige menu (alleen < lg). */
export function MobileHeader() {
  const { project } = useShell();
  const lade = useRef<HTMLDialogElement>(null);
  const sluit = () => lade.current?.close();

  return (
    <>
      <header className="border-border bg-background/85 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-md lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => lade.current?.showModal()}
          className="text-foreground hover:bg-surface-2 -ml-2 rounded-lg p-2"
          aria-label="Menu openen"
        >
          <Menu className="size-5" />
        </button>
        <Logo className="size-7" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
          {project.naam}
        </p>
      </header>

      <dialog
        ref={lade}
        aria-label="Menu"
        className="anim-drawer bg-sidebar m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none p-0"
        onClick={(e) => {
          if (e.target === e.currentTarget) sluit();
        }}
      >
        <button
          type="button"
          onClick={sluit}
          className="text-sidebar-muted hover:text-sidebar-foreground absolute top-5 right-3 z-10 rounded-lg p-1.5"
          aria-label="Menu sluiten"
        >
          <X className="size-5" />
        </button>
        <SidebarContent onNavigate={sluit} />
      </dialog>
    </>
  );
}

function Tab({ item, pathname }: { item: NavItem; pathname: string }) {
  const actief = isActive(pathname, item.href);
  const badge = useShell().badges[item.href] ?? item.badge;
  return (
    <Link
      href={item.href}
      aria-current={actief ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium",
        actief ? "text-accent-ink" : "text-muted",
      )}
    >
      <span className="relative">
        <item.icon className="size-[22px]" strokeWidth={actief ? 2.25 : 1.75} />
        {badge ? (
          <span className="bg-gold text-gold-foreground absolute -top-1.5 -right-2.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold">
            {badge}
          </span>
        ) : null}
      </span>
      {item.label}
    </Link>
  );
}

/** Tabbalk onderin met centrale "+"-knop (alleen < lg). */
export function MobileTabbar() {
  const pathname = usePathname();
  const [een, twee, drie, vier] = mobileTabs;

  return (
    <nav
      aria-label="Snelmenu"
      className="border-border bg-surface/95 safe-bottom fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md lg:hidden print:hidden"
    >
      <div className="mx-auto flex max-w-md items-end px-2">
        <Tab item={een} pathname={pathname} />
        <Tab item={twee} pathname={pathname} />
        <div className="flex flex-1 justify-center">
          <AddDocumentFab />
        </div>
        <Tab item={drie} pathname={pathname} />
        <Tab item={vier} pathname={pathname} />
      </div>
    </nav>
  );
}
