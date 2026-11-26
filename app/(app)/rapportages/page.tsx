import { ChartColumn } from "lucide-react";
import type { Metadata } from "next";
import { Binnenkort } from "@/components/shell/binnenkort";

export const metadata: Metadata = { title: "Rapportages" };

export default function Page() {
  return (
    <Binnenkort
      titel="Rapportages"
      omschrijving="Overzichten en exports."
      icon={ChartColumn}
      fase="fase 7"
      punten={[
        "Per categorie, ruimte en leverancier",
        "Export naar Excel/CSV en PDF",
      ]}
    />
  );
}
