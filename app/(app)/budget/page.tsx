import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Binnenkort } from "@/components/shell/binnenkort";

export const metadata: Metadata = { title: "Budget" };

export default function Page() {
  return (
    <Binnenkort
      titel="Budget"
      omschrijving="Categorieën, budgetten, prognoses en afwijkingen."
      icon={Wallet}
      fase="fase 4"
      punten={[
        "Categorieboom met budget, gecontracteerd, gefactureerd, betaald en prognose",
        "Categorie afsluiten met controle op openstaande posten",
        "Direct bewerken van budgetregels",
      ]}
    />
  );
}
