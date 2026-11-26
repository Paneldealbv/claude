import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { DocumentLijst } from "@/components/documenten/lijst";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { documentOverzicht } from "@/lib/data/documenten";

export const metadata: Metadata = { title: "Te controleren" };

export default async function TeControlerenPagina() {
  const project = await getActiefProject();
  const documenten = (await documentOverzicht(project.id)).filter(
    (d) => d.status === "concept" || d.status === "te_controleren",
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        titel="Te controleren"
        omschrijving="Documenten die nog niet zijn geboekt. Ze tellen pas mee als iemand ze heeft gecontroleerd en geboekt."
      />
      <Card aria-labelledby="lijst-titel" className="overflow-hidden">
        <CardHeader
          id="lijst-titel"
          title={`${documenten.length} nog niet geboekt`}
          className="pb-4"
        />
        <DocumentLijst
          documenten={documenten}
          leeg="Alles is geboekt. Er staat niets te wachten."
        />
      </Card>
      <p className="text-muted flex items-start gap-2 text-sm">
        <Sparkles className="text-accent-ink mt-0.5 size-4 shrink-0" />
        Vanaf fase 8 verschijnen hier ook de voorstellen van de AI, met het
        originele document ernaast. Ook die tellen pas mee na jouw controle.
      </p>
    </div>
  );
}
