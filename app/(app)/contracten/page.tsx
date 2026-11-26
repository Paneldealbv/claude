import { Handshake } from "lucide-react";
import type { Metadata } from "next";
import { Binnenkort } from "@/components/shell/binnenkort";

export const metadata: Metadata = { title: "Contracten" };

export default function Page() {
  return (
    <Binnenkort
      titel="Contracten"
      omschrijving="Opdrachten, termijnschema's en meer-/minderwerk."
      icon={Handshake}
      fase="fase 5"
      punten={[
        "Contractregels per categorie",
        "Termijnschema en gekoppelde termijnfacturen",
        "Meer- en minderwerk met goedkeuring",
      ]}
    />
  );
}
