import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ContractFormulier } from "@/components/contracten/formulieren";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { categorieOpties, laadLeveranciers } from "@/lib/data/offertes";
import { laadProjectInvoer } from "@/lib/data/project";

export const metadata: Metadata = { title: "Nieuw contract" };

export default async function NieuwContractPagina({
  searchParams,
}: PageProps<"/contracten/nieuw">) {
  const project = await getActiefProject();
  if (project.rol === "lezer") redirect("/contracten");
  const { leverancier } = await searchParams;
  const [leveranciers, invoer] = await Promise.all([
    laadLeveranciers(project.id),
    laadProjectInvoer(project.id),
  ]);
  const categorieen = categorieOpties(invoer.categorieen);

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link href="/contracten" className="hover:text-foreground">
          Contracten
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Nieuw</span>
      </nav>
      <PageHeader
        titel="Nieuw contract"
        omschrijving="Voor een afspraak zonder offerte in het dashboard. Heb je een offerte? Accepteer die dan, dan worden de regels overgenomen."
      />
      <Card className="max-w-4xl">
        <div className="p-5 sm:p-6">
          {categorieen.length ? (
            <ContractFormulier
              leveranciers={leveranciers}
              categorieen={categorieen}
              standaardLeverancier={
                leveranciers.find((l) => l.id === leverancier)?.id
              }
            />
          ) : (
            <p className="text-muted text-sm">
              Een contract telt mee in een categorie van je budget. Maak eerst
              je{" "}
              <Link
                href="/budget"
                className="text-accent-ink font-medium hover:underline"
              >
                categorieën
              </Link>{" "}
              aan.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
