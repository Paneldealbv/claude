import { Landmark } from "lucide-react";
import type { Metadata } from "next";
import { Binnenkort } from "@/components/shell/binnenkort";

export const metadata: Metadata = { title: "Financiering" };

export default function Page() {
  return (
    <Binnenkort
      titel="Financiering"
      omschrijving="Hypotheek, bouwdepot, eigen geld en overige bronnen."
      icon={Landmark}
      fase="fase 9"
      punten={[
        "Hypotheek met bouwdepot als onderdeel",
        "Saldo per bron",
        "Declaraties bij het bouwdepot",
      ]}
    />
  );
}
