"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function abonneer(melden: () => void) {
  window.addEventListener("online", melden);
  window.addEventListener("offline", melden);
  return () => {
    window.removeEventListener("online", melden);
    window.removeEventListener("offline", melden);
  };
}

/**
 * Melding als het toestel geen verbinding heeft. De app bewaart bewust geen
 * financiële gegevens offline; zonder verbinding kun je niets opslaan.
 */
export function OfflineMelding() {
  const online = useSyncExternalStore(
    abonneer,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="bg-warning-soft text-warning border-warning/30 fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg"
    >
      <WifiOff className="size-4 shrink-0" />
      Geen verbinding. Wijzigingen worden pas opgeslagen als je weer online
      bent.
    </div>
  );
}
