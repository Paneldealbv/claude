import { Settings } from "lucide-react";
import type { Metadata } from "next";
import { Binnenkort } from "@/components/shell/binnenkort";

export const metadata: Metadata = { title: "Instellingen" };

export default function Page() {
  return (
    <Binnenkort
      titel="Instellingen"
      omschrijving="Project, categorieën, ruimtes en gebruikers."
      icon={Settings}
      fase="fase 2 en 4"
      punten={[
        "Projectgegevens",
        "Leden uitnodigen en rollen instellen",
        "Profiel en wachtwoord",
      ]}
    />
  );
}
