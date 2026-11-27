import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeclaratieFormulier } from "@/components/financiering/declaraties";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { vandaagIso } from "@/lib/datum";
import {
  declarabeleDocumenten,
  laadFinanciering,
} from "@/lib/data/financiering";
import { formatEuro } from "@/lib/format";

export const metadata: Metadata = { title: "Declaratie maken" };

export default async function DeclaratieMakenPagina({
  searchParams,
}: PageProps<"/financiering/declaraties/nieuw">) {
  const project = await getActiefProject();
  if (project.rol === "lezer") redirect("/financiering");
  const gevraagd = (await searchParams).depot;
  const [{ depots }, documenten] = await Promise.all([
    laadFinanciering(project.id),
    declarabeleDocumenten(project.id),
  ]);
  const depot = depots.find((d) => d.id === gevraagd) ?? depots[0];
  if (!depot) redirect("/financiering");

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link href="/financiering" className="hover:text-foreground">
          Financiering
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Declaratie maken</span>
      </nav>
      <PageHeader
        titel="Declaratie maken"
        omschrijving={`Kies de facturen die je bij de bank indient voor het bouwdepot van ${depot.hypotheek} (${formatEuro(depot.bedrag)}).`}
      />
      <Card className="max-w-3xl">
        <div className="p-5 sm:p-6">
          <DeclaratieFormulier
            depot={{ id: depot.id, vrij: depot.stand.vrij }}
            documenten={documenten}
            vandaag={vandaagIso()}
          />
        </div>
      </Card>
    </div>
  );
}
