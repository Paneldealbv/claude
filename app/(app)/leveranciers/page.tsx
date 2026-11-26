import { Store } from "lucide-react";
import type { Metadata } from "next";
import { Binnenkort } from "@/components/shell/binnenkort";

export const metadata: Metadata = { title: "Leveranciers" };

export default function Page() {
  return (
    <Binnenkort
      titel="Leveranciers"
      omschrijving="Contactgegevens en totalen per leverancier."
      icon={Store}
      fase="fase 5"
      punten={[
        "Contactgegevens, IBAN en KvK",
        "Alle offertes, contracten en facturen per leverancier",
      ]}
    />
  );
}
