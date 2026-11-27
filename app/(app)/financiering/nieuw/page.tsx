import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BronFormulier } from "@/components/financiering/formulieren";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { BRON_TYPE, HOOFDBRONNEN, type HoofdbronSoort } from "@/lib/labels";

export const metadata: Metadata = { title: "Bron toevoegen" };

export default async function BronToevoegenPagina({
  searchParams,
}: PageProps<"/financiering/nieuw">) {
  const project = await getActiefProject();
  if (project.rol === "lezer") redirect("/financiering");
  const gevraagd = (await searchParams).type;
  const type: HoofdbronSoort = (HOOFDBRONNEN as readonly string[]).includes(
    String(gevraagd),
  )
    ? (gevraagd as HoofdbronSoort)
    : "hypotheek";

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
        <span className="text-foreground">Bron toevoegen</span>
      </nav>
      <PageHeader
        titel="Bron toevoegen"
        omschrijving="Eigen geld, een hypotheek (met bouwdepot), een schenking of een lening."
      />
      <Card className="max-w-3xl">
        <div className="p-5 sm:p-6">
          <BronFormulier
            bron={{
              type,
              naam: BRON_TYPE[type].tekst,
              verstrekker: null,
              bedrag: null,
              renteBp: null,
              start: null,
              eind: null,
              notities: null,
              bouwdepot: null,
              depotEind: null,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
