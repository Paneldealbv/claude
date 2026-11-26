import { Camera, Sparkles, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DocumentLijst } from "@/components/documenten/lijst";
import { VoorstelLijst } from "@/components/herkenning/voorstel-lijst";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { documentOverzicht } from "@/lib/data/documenten";
import { laadVoorstellen } from "@/lib/data/herkenning";

export const metadata: Metadata = { title: "Te controleren" };

export default async function TeControlerenPagina() {
  const project = await getActiefProject();
  const [alle, voorstellen] = await Promise.all([
    documentOverzicht(project.id),
    laadVoorstellen(project.id),
  ]);
  const documenten = alle.filter(
    (d) => d.status === "concept" || d.status === "te_controleren",
  );
  const lezer = project.rol === "lezer";

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        titel="Te controleren"
        omschrijving="Voorstellen van de AI en documenten die nog niet zijn geboekt. Ze tellen pas mee als iemand ze heeft gecontroleerd en geboekt."
        actie={
          !lezer && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/te-controleren/nieuw?bron=camera"
                className={knopKlassen("secundair")}
              >
                <Camera className="size-4" />
                Bon fotograferen
              </Link>
              <Link
                href="/te-controleren/nieuw"
                className={knopKlassen("primair")}
              >
                <Upload className="size-4" />
                Factuur uploaden
              </Link>
            </div>
          )
        }
      />
      <Card aria-labelledby="voorstellen-titel" className="overflow-hidden">
        <CardHeader
          id="voorstellen-titel"
          title={
            voorstellen.length
              ? `${voorstellen.length} ${voorstellen.length === 1 ? "voorstel" : "voorstellen"} van de AI`
              : "Voorstellen van de AI"
          }
          description="Uitgelezen facturen en bonnen. Controleer ze met het origineel ernaast en boek ze."
          className="pb-4"
        />
        {voorstellen.length ? (
          <VoorstelLijst voorstellen={voorstellen} />
        ) : (
          <p className="border-border text-muted flex items-start gap-2 border-t px-5 py-5 text-sm sm:px-6">
            <Sparkles className="text-accent-ink mt-0.5 size-4 shrink-0" />
            Geen voorstellen. Fotografeer een bon of upload een factuur; de AI
            leest hem uit en zet het voorstel hier klaar.
          </p>
        )}
      </Card>
      <Card aria-labelledby="lijst-titel" className="overflow-hidden">
        <CardHeader
          id="lijst-titel"
          title={`${documenten.length} nog niet geboekt`}
          description="Concepten en documenten die op controle wachten."
          className="pb-4"
        />
        <DocumentLijst
          documenten={documenten}
          leeg="Alles is geboekt. Er staat niets te wachten."
        />
      </Card>
    </div>
  );
}
