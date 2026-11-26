import { DoorOpen } from "lucide-react";
import type { Metadata } from "next";
import { Binnenkort } from "@/components/shell/binnenkort";

export const metadata: Metadata = { title: "Ruimtes" };

export default function Page() {
  return (
    <Binnenkort
      titel="Ruimtes"
      omschrijving="Kosten per ruimte, los van de financiële categorieën."
      icon={DoorOpen}
      fase="fase 4"
      punten={[
        "Ruimtes beheren (keuken, woonkamer, slaapkamers …)",
        "Kosten verdelen over één of meer ruimtes",
        "Rapport per ruimte zonder dubbeltelling",
      ]}
    />
  );
}
