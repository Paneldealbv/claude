import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OfferteFormulier } from "@/components/offertes/formulieren";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { bestandMetLink } from "@/lib/data/bestanden";
import {
  categorieOpties,
  laadLeveranciers,
  laadOffertes,
} from "@/lib/data/offertes";
import { laadProjectInvoer } from "@/lib/data/project";

export const metadata: Metadata = { title: "Offerte bewerken" };

export default async function OfferteBewerkenPagina({
  params,
}: PageProps<"/offertes/[id]/bewerken">) {
  const { id } = await params;
  const project = await getActiefProject();
  const [offertes, leveranciers, invoer] = await Promise.all([
    laadOffertes(project.id),
    laadLeveranciers(project.id),
    laadProjectInvoer(project.id),
  ]);
  const offerte = offertes.find((o) => o.id === id);
  if (!offerte) notFound();
  // Geaccepteerd: wijzigingen horen dan bij het contract.
  if (project.rol === "lezer" || offerte.status === "geaccepteerd") {
    redirect(`/offertes/${id}`);
  }
  const bestand = await bestandMetLink(offerte.bestandId);

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link href="/offertes" className="hover:text-foreground">
          Offertes
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <Link
          href={`/offertes/${id}`}
          className="hover:text-foreground truncate"
        >
          {offerte.titel}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="text-foreground">Bewerken</span>
      </nav>
      <PageHeader titel="Offerte bewerken" />
      <Card className="max-w-4xl">
        <div className="p-5 sm:p-6">
          <OfferteFormulier
            leveranciers={leveranciers}
            categorieen={categorieOpties(invoer.categorieen)}
            offerte={{
              id: offerte.id,
              titel: offerte.titel,
              nummer: offerte.nummer,
              datum: offerte.datum,
              geldigTot: offerte.geldigTot,
              leverancierId: offerte.leverancierId,
              notities: offerte.notities,
              regels: offerte.regels,
            }}
            bestand={
              bestand
                ? {
                    id: bestand.id,
                    naam: bestand.naam,
                    grootte: bestand.grootte,
                    type: bestand.type,
                  }
                : null
            }
          />
        </div>
      </Card>
    </div>
  );
}
