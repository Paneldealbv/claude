import { ScanSearch } from "lucide-react";
import type { Metadata } from "next";
import { Binnenkort } from "@/components/shell/binnenkort";

export const metadata: Metadata = { title: "Te controleren" };

export default function Page() {
  return (
    <Binnenkort
      titel="Te controleren"
      omschrijving="AI-voorstellen die nog bevestigd moeten worden."
      icon={ScanSearch}
      fase="fase 8"
      punten={[
        "Origineel naast het voorstel",
        "Markeringen: ontbreekt, klopt niet, onzeker, duplicaat",
        "Pas na bevestiging geboekt",
      ]}
    />
  );
}
