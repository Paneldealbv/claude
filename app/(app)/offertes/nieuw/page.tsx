import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OfferteFormulier } from "@/components/offertes/formulieren";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { categorieOpties, laadLeveranciers } from "@/lib/data/offertes";
import { laadProjectInvoer } from "@/lib/data/project";

export const metadata: Metadata = { title: "Nieuwe offerte" };

export default async function NieuweOffertePagina({
  searchParams,
}: PageProps<"/offertes/nieuw">) {
  const project = await getActiefProject();
  if (project.rol === "lezer") redirect("/offertes");
  const { leverancier } = await searchParams;
  const [leveranciers, invoer] = await Promise.all([
    laadLeveranciers(project.id),
    laadProjectInvoer(project.id),
  ]);
  const gekozen = leveranciers.find((l) => l.id === leverancier)?.id;
  const categorieen = categorieOpties(invoer.categorieen);

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link href="/offertes" className="hover:text-foreground">
          Offertes
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Nieuw</span>
      </nav>
      <PageHeader
        titel="Nieuwe offerte"
        omschrijving="Een offerte telt nog niet mee in je budget. Pas als je hem accepteert, wordt het een contract."
      />
      <Card className="max-w-4xl">
        <div className="p-5 sm:p-6">
          {categorieen.length === 0 && (
            <p className="bg-surface-2 text-muted mb-5 rounded-xl px-3.5 py-3 text-sm">
              Je hebt nog geen categorieën. Je kunt de offerte bewaren, maar om
              hem te accepteren heeft elke regel een categorie nodig.{" "}
              <Link
                href="/budget"
                className="text-accent-ink font-medium hover:underline"
              >
                Categorieën aanmaken
              </Link>
            </p>
          )}
          <OfferteFormulier
            leveranciers={leveranciers}
            categorieen={categorieen}
            standaardLeverancier={gekozen}
          />
        </div>
      </Card>
    </div>
  );
}
