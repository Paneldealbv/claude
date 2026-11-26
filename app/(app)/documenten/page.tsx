import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import { Binnenkort } from "@/components/shell/binnenkort";

export const metadata: Metadata = { title: "Facturen & bonnen" };

export default function Page() {
  return (
    <Binnenkort
      titel="Facturen & bonnen"
      omschrijving="Alle facturen, termijnfacturen, creditnota's en bonnen."
      icon={Receipt}
      fase="fase 6"
      punten={[
        "Eén bon opsplitsen in meerdere kostenregels",
        "Betalingen en deelbetalingen registreren",
        "Betaalstatus en vervaldatums",
      ]}
    />
  );
}
