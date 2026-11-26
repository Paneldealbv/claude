import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { Binnenkort } from "@/components/shell/binnenkort";

export const metadata: Metadata = { title: "Offertes" };

export default function Page() {
  return (
    <Binnenkort
      titel="Offertes"
      omschrijving="Ontvangen offertes vergelijken en accepteren."
      icon={FileText}
      fase="fase 5"
      punten={[
        "Offertes met PDF bewaren en vergelijken",
        "Accepteren zet een offerte om in een contract",
        "Offertes tellen nooit mee in de kosten",
      ]}
    />
  );
}
