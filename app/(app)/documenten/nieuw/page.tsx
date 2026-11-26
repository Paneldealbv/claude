import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  DocumentFormulier,
  type BestandKeuze,
  type DocumentInvoer,
} from "@/components/documenten/formulieren";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { vandaagIso } from "@/lib/datum";
import { documentKeuzes } from "@/lib/data/documenten";
import { DOCUMENT_TYPE, type DocumentSoort } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Document toevoegen" };

const eerste = (w: string | string[] | undefined) =>
  Array.isArray(w) ? w[0] : w;

export default async function NieuwDocumentPagina({
  searchParams,
}: PageProps<"/documenten/nieuw">) {
  const project = await getActiefProject();
  if (project.rol === "lezer") redirect("/documenten");
  const zoek = await searchParams;
  const keuzes = await documentKeuzes(project.id);

  // Bestand dat al is geüpload (bijv. via "Bon fotograferen" zonder AI).
  let bestand: BestandKeuze | null = null;
  const bestandId = eerste(zoek.bestand);
  if (bestandId && z.uuid().safeParse(bestandId).success) {
    const supabase = await createClient();
    const { data: f } = await supabase
      .from("files")
      .select("id, original_name, size_bytes, mime_type")
      .eq("project_id", project.id)
      .eq("id", bestandId)
      .maybeSingle();
    if (f) {
      bestand = {
        id: f.id,
        naam: f.original_name,
        grootte: f.size_bytes,
        type: f.mime_type,
      };
    }
  }

  // Voorinvulling, bijv. vanaf een termijn of contract.
  const gevraagd = eerste(zoek.type);
  let type: DocumentSoort =
    gevraagd && gevraagd in DOCUMENT_TYPE
      ? (gevraagd as DocumentSoort)
      : "factuur";
  const contract = keuzes.contracten.find(
    (c) => c.id === eerste(zoek.contract),
  );
  const termijn = contract?.termijnen.find(
    (t) => t.id === eerste(zoek.termijn),
  );
  if (termijn) type = "termijnfactuur";
  const leverancierId =
    keuzes.leveranciers.find((l) => l.id === eerste(zoek.leverancier))?.id ??
    contract?.leverancierId ??
    null;

  const regels: DocumentInvoer["regels"] = [];
  if (contract && termijn) {
    regels.push({
      omschrijving: `Termijn ${termijn.volgorde}: ${termijn.omschrijving}`,
      doel: `c:${contract.id}`,
      bedrag: Math.max(0, termijn.verwacht - termijn.gefactureerd) || null,
      btw: 2100,
      ruimtes: [],
    });
  } else if (contract && type === "eindfactuur") {
    regels.push({
      omschrijving: "Eindafrekening",
      doel: `c:${contract.id}`,
      bedrag: contract.nogTeFactureren > 0 ? contract.nogTeFactureren : null,
      btw: 2100,
      ruimtes: [],
    });
  }

  const document: DocumentInvoer = {
    type,
    leverancierId,
    contractId: contract?.id ?? null,
    termijnId: termijn?.id ?? null,
    nummer: null,
    datum: vandaagIso(),
    vervalDatum: null,
    totaalOpDocument: null,
    notities: null,
    regels,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link href="/documenten" className="hover:text-foreground">
          Facturen &amp; bonnen
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Toevoegen</span>
      </nav>
      <PageHeader
        titel="Document toevoegen"
        omschrijving="Een factuur, termijnfactuur, eindfactuur, creditnota of bon. Pas als je het boekt, telt het mee."
      />
      <Card className="max-w-5xl">
        <div className="p-5 sm:p-6">
          {keuzes.categorieen.length === 0 && keuzes.contracten.length === 0 ? (
            <p className="text-muted text-sm">
              Kosten horen bij een contract of een categorie van je budget. Maak
              eerst je{" "}
              <Link
                href="/budget"
                className="text-accent-ink font-medium hover:underline"
              >
                categorieën
              </Link>{" "}
              aan.
            </p>
          ) : (
            <DocumentFormulier
              document={document}
              bestand={bestand}
              leveranciers={keuzes.leveranciers}
              contracten={keuzes.contracten}
              categorieen={keuzes.categorieen}
              ruimtes={keuzes.ruimtes}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
