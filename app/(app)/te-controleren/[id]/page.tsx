import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BestandKaart } from "@/components/bestanden/bestand-kaart";
import {
  DocumentFormulier,
  type DocumentInvoer,
} from "@/components/documenten/formulieren";
import { Aandachtspunten } from "@/components/herkenning/aandachtspunten";
import {
  OpnieuwUitlezen,
  VerversTijdensUitlezen,
  VoorstelVerwijderen,
} from "@/components/herkenning/acties";
import type { NieuweLeverancier } from "@/components/invoer/leverancier-keuze";
import { Card, CardHeader } from "@/components/ui/card";
import { Melding } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, type StatusSoort } from "@/components/ui/status";
import { aiBeschikbaar } from "@/lib/ai/herkennen";
import { letOpPerVeld, voorstelNaarInvoer } from "@/lib/ai/voorstel";
import { getActiefProject } from "@/lib/auth";
import { vandaagIso } from "@/lib/datum";
import { bestandMetLink } from "@/lib/data/bestanden";
import { documentKeuzes } from "@/lib/data/documenten";
import { laadVoorstel } from "@/lib/data/herkenning";

export const metadata: Metadata = { title: "Voorstel controleren" };

// "Opnieuw uitlezen" draait in een serveractie van deze pagina (max. 60 s).
export const maxDuration = 60;

export default async function VoorstelPagina({
  params,
}: PageProps<"/te-controleren/[id]">) {
  const { id } = await params;
  const project = await getActiefProject();
  const voorstel = await laadVoorstel(project.id, id);
  if (!voorstel) notFound();
  if (voorstel.status === "verwerkt" && voorstel.documentId) {
    redirect(`/documenten/${voorstel.documentId}`);
  }
  const [keuzes, bestand] = await Promise.all([
    documentKeuzes(project.id),
    bestandMetLink(voorstel.bestand.id),
  ]);

  const lezer = project.rol === "lezer";
  const h = voorstel.herkenning;
  const bezig =
    (voorstel.status === "bezig" || voorstel.status === "wachtrij") &&
    !voorstel.vastgelopen;
  const klaar = voorstel.status === "te_controleren" && h !== null;
  const mislukt = !bezig && !klaar && voorstel.status !== "verwerkt";

  const status: { soort: StatusSoort; tekst: string } = bezig
    ? { soort: "info", tekst: "Wordt uitgelezen" }
    : klaar
      ? { soort: "waarschuwing", tekst: "Te controleren" }
      : voorstel.status === "verwerkt"
        ? { soort: "positief", tekst: "Verwerkt" }
        : {
            soort: "kritiek",
            tekst: voorstel.vastgelopen ? "Afgebroken" : "Niet gelukt",
          };

  // Formulier: het voorstel, of leeg om zelf in te voeren.
  let document: DocumentInvoer = {
    type: "factuur",
    leverancierId: null,
    contractId: null,
    termijnId: null,
    nummer: null,
    datum: vandaagIso(),
    vervalDatum: null,
    totaalOpDocument: null,
    notities: null,
    regels: [],
  };
  let nieuweLeverancier: NieuweLeverancier | null = null;
  if (klaar && h) {
    const v = voorstelNaarInvoer(h, voorstel.leverancierId);
    document = { ...v, notities: null };
    if (v.nieuweLeverancier) {
      nieuweLeverancier = {
        naam: v.nieuweLeverancier.slice(0, 120),
        kvk: h.leverancier_kvk.waarde,
        iban: h.leverancier_iban.waarde,
        btwNummer: h.leverancier_btw_nummer.waarde,
      };
    }
  }
  const kanInvoeren =
    keuzes.categorieen.length > 0 || keuzes.contracten.length > 0;

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
        <span className="text-foreground">Voorstel</span>
      </nav>
      <PageHeader
        titel="Voorstel controleren"
        omschrijving={
          klaar
            ? "De AI heeft het document uitgelezen. Vergelijk het voorstel met het origineel, pas aan waar nodig en boek het. Pas dan telt het mee."
            : "Het originele document staat links (op een telefoon: hierboven)."
        }
        actie={<StatusPill soort={status.soort}>{status.tekst}</StatusPill>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <div className="lg:sticky lg:top-6">
          <BestandKaart bestand={bestand} omschrijving="Origineel" />
        </div>

        <div className="min-w-0 space-y-6">
          {bezig && (
            <Card>
              <div className="flex items-start gap-3 p-5 sm:p-6">
                <Loader2 className="text-accent-ink mt-0.5 size-5 shrink-0 animate-spin" />
                <div>
                  <p className="font-medium">De AI leest het document…</p>
                  <p className="text-muted mt-1 text-sm">
                    Dit duurt meestal 10 tot 40 seconden. Deze pagina ververst
                    vanzelf.
                  </p>
                </div>
              </div>
              <VerversTijdensUitlezen />
            </Card>
          )}

          {mislukt && (
            <Card>
              <div className="space-y-4 p-5 sm:p-6">
                <Melding soort="fout">
                  {voorstel.vastgelopen
                    ? "Het uitlezen is afgebroken (het duurde te lang)."
                    : (voorstel.fout ?? "Het uitlezen is niet gelukt.")}
                </Melding>
                {!lezer && (
                  <div className="flex flex-wrap items-center gap-3">
                    {aiBeschikbaar() && <OpnieuwUitlezen id={voorstel.id} />}
                    <p className="text-muted text-sm">
                      Of vul de gegevens hieronder zelf in.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {klaar && h && (
            <Aandachtspunten
              punten={voorstel.punten}
              opmerkingen={h.opmerkingen}
            />
          )}

          {voorstel.status === "verwerkt" && (
            <Melding soort="succes">Dit voorstel is al verwerkt.</Melding>
          )}

          {!bezig && voorstel.status !== "verwerkt" && (
            <Card aria-labelledby="gegevens-titel">
              <CardHeader
                id="gegevens-titel"
                title={klaar ? "Gegevens" : "Zelf invoeren"}
                description={
                  klaar ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="text-accent-ink size-3.5" />
                      Ingevuld door de AI. Controleer elk veld.
                    </span>
                  ) : undefined
                }
                className="pb-4"
              />
              <div className="border-border border-t p-5 sm:p-6">
                {lezer ? (
                  <p className="text-muted text-sm">
                    Je hebt alleen leesrechten in dit project. Een bewerker kan
                    dit voorstel controleren en boeken.
                  </p>
                ) : !kanInvoeren ? (
                  <p className="text-muted text-sm">
                    Kosten horen bij een contract of een categorie van je
                    budget. Maak eerst je{" "}
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
                    bestand={{
                      id: voorstel.bestand.id,
                      naam: voorstel.bestand.naam,
                      type: voorstel.bestand.type,
                    }}
                    bestandVast
                    extractieId={voorstel.id}
                    letOp={klaar ? letOpPerVeld(voorstel.punten) : {}}
                    nieuweLeverancier={nieuweLeverancier}
                    leveranciers={keuzes.leveranciers}
                    contracten={keuzes.contracten}
                    categorieen={keuzes.categorieen}
                    ruimtes={keuzes.ruimtes}
                  />
                )}
              </div>
            </Card>
          )}

          {!lezer && !bezig && voorstel.status !== "verwerkt" && (
            <Card aria-labelledby="verwijderen-titel">
              <CardHeader
                id="verwijderen-titel"
                title="Voorstel verwijderen"
                className="pb-4"
              />
              <div className="border-border border-t p-5 sm:p-6">
                <VoorstelVerwijderen id={voorstel.id} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
