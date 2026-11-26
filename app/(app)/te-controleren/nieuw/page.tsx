import { ChevronRight, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HerkenFormulier } from "@/components/herkenning/herken-formulier";
import { Card } from "@/components/ui/card";
import { Melding } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { aiBeschikbaar } from "@/lib/ai/herkennen";
import { getActiefProject } from "@/lib/auth";

export const metadata: Metadata = { title: "Document uitlezen" };

// Het uitlezen gebeurt in de serveractie van deze pagina (max. 60 s).
export const maxDuration = 60;

const eerste = (w: string | string[] | undefined) =>
  Array.isArray(w) ? w[0] : w;

export default async function DocumentUitlezenPagina({
  searchParams,
}: PageProps<"/te-controleren/nieuw">) {
  const project = await getActiefProject();
  if (project.rol === "lezer") redirect("/te-controleren");
  const camera = eerste((await searchParams).bron) === "camera";
  const beschikbaar = aiBeschikbaar();

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link href="/te-controleren" className="hover:text-foreground">
          Te controleren
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Uitlezen</span>
      </nav>
      <PageHeader
        titel={camera ? "Bon fotograferen" : "Factuur of bon uploaden"}
        omschrijving="De AI leest het document uit en doet een voorstel. Jij controleert het en boekt het; pas dan telt het mee."
      />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <div className="space-y-5 p-5 sm:p-6">
            {!beschikbaar && (
              <Melding soort="info">
                De AI-herkenning is nog niet ingesteld. Je kunt het document wel
                uploaden; daarna vul je de gegevens zelf in.
              </Melding>
            )}
            <HerkenFormulier beschikbaar={beschikbaar} camera={camera} />
          </div>
        </Card>
        <aside
          aria-labelledby="tips-titel"
          className="border-border rounded-2xl border border-dashed p-5 text-sm sm:p-6"
        >
          <h2
            id="tips-titel"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <Lightbulb className="text-gold size-4" />
            Zo lukt het uitlezen het best
          </h2>
          <ul className="text-muted mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
            <li>Een PDF van de leverancier werkt het best.</li>
            <li>
              Foto: leg de bon plat, met goed licht en zonder schaduw. Zorg dat
              datum, totaal en BTW leesbaar zijn.
            </li>
            <li>Eén document per keer; een lange bon mag in één foto.</li>
            <li>
              De AI geeft aan wat onzeker is. Controleer die punten altijd met
              het origineel.
            </li>
          </ul>
          <p className="text-muted border-border mt-4 border-t pt-4 text-xs leading-relaxed">
            Voor het uitlezen wordt het document naar Claude (Anthropic)
            gestuurd. Het origineel blijft in de afgeschermde opslag van je
            project.
          </p>
        </aside>
      </div>
    </div>
  );
}
