import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentFormulier } from "@/components/documenten/formulieren";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { bestandMetLink } from "@/lib/data/bestanden";
import { documentKeuzes, laadDocument } from "@/lib/data/documenten";
import { DOCUMENT_TYPE } from "@/lib/labels";

export const metadata: Metadata = { title: "Document bewerken" };

export default async function DocumentBewerkenPagina({
  params,
}: PageProps<"/documenten/[id]/bewerken">) {
  const { id } = await params;
  const project = await getActiefProject();
  const [document, keuzes] = await Promise.all([
    laadDocument(id),
    documentKeuzes(project.id),
  ]);
  if (!document) notFound();
  if (project.rol === "lezer" || document.status === "vervallen") {
    redirect(`/documenten/${id}`);
  }
  const bestand = await bestandMetLink(document.bestandId);
  // Een creditnota staat negatief in de database, maar wordt ingevuld zoals
  // op het papier (positief).
  const teken = (bedrag: number) =>
    document.type === "creditnota" ? -bedrag : bedrag;

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link href="/documenten" className="hover:text-foreground">
          Facturen &amp; bonnen
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <Link
          href={`/documenten/${id}`}
          className="hover:text-foreground truncate"
        >
          {DOCUMENT_TYPE[document.type].tekst} {document.nummer ?? ""}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="text-foreground">Bewerken</span>
      </nav>
      <PageHeader
        titel="Document bewerken"
        omschrijving={
          document.status === "geboekt"
            ? "Het document is geboekt. Wijzigingen worden in één keer opgeslagen en moeten blijven kloppen met wat er al betaald is."
            : undefined
        }
      />
      <Card className="max-w-5xl">
        <div className="p-5 sm:p-6">
          <DocumentFormulier
            document={{
              id: document.id,
              type: document.type,
              status: document.status,
              leverancierId: document.leverancierId,
              contractId: document.contractId,
              termijnId: document.termijnId,
              nummer: document.nummer,
              datum: document.datum,
              vervalDatum: document.vervalDatum,
              totaalOpDocument:
                document.totaalOpDocument === null
                  ? null
                  : teken(document.totaalOpDocument),
              notities: document.notities,
              regels: document.regels.map((r) => ({
                omschrijving: r.omschrijving,
                doel: r.contractRegelId
                  ? `r:${r.contractRegelId}`
                  : r.contractId
                    ? `c:${r.contractId}`
                    : `k:${r.categorieId}`,
                bedrag: teken(r.bedrag),
                btw: r.btw,
                ruimtes: r.ruimteIds,
              })),
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
            leveranciers={keuzes.leveranciers}
            contracten={keuzes.contracten}
            categorieen={keuzes.categorieen}
            ruimtes={keuzes.ruimtes}
          />
        </div>
      </Card>
    </div>
  );
}
