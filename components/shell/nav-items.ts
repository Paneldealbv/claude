import {
  ChartColumn,
  DoorOpen,
  FileText,
  Handshake,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  ScanSearch,
  Settings,
  Store,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aantal dat als badge wordt getoond (demo). */
  badge?: number;
};

export type NavGroup = { label: string | null; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Kosten",
    items: [
      { href: "/budget", label: "Budget", icon: Wallet },
      { href: "/ruimtes", label: "Ruimtes", icon: DoorOpen },
      { href: "/offertes", label: "Offertes", icon: FileText },
      { href: "/contracten", label: "Contracten", icon: Handshake },
      { href: "/documenten", label: "Facturen & bonnen", icon: Receipt },
      { href: "/te-controleren", label: "Te controleren", icon: ScanSearch },
    ],
  },
  {
    label: "Overzicht",
    items: [
      { href: "/leveranciers", label: "Leveranciers", icon: Store },
      { href: "/financiering", label: "Financiering", icon: Landmark },
      { href: "/rapportages", label: "Rapportages", icon: ChartColumn },
    ],
  },
];

export const settingsItem: NavItem = {
  href: "/instellingen",
  label: "Instellingen",
  icon: Settings,
};

/** Vaste tabs in de mobiele tabbalk (de "+"-knop staat in het midden). */
export const mobileTabs: NavItem[] = [
  { href: "/dashboard", label: "Overzicht", icon: LayoutDashboard },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/documenten", label: "Documenten", icon: Receipt },
  { href: "/te-controleren", label: "Controle", icon: ScanSearch },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}
