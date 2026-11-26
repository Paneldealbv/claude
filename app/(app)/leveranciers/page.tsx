import { ChevronRight, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LeverancierFormulier } from "@/components/leveranciers/formulieren";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { laadLeveranciers, laadOffertes } from "@/lib/data/offertes";
import { laadProjectResultaat } from "@/lib/data/project";
import { formatEuro } from "@/lib/format";

export const metadata: Metadata = { title: "Leveranciers" };

const heel = { centen: false } as const;

export default async function LeveranciersPagina() {
  const project = await getActiefProject();
  const [leveranciers, offertes, { invoer, resultaat }] = await Promise.all([
    laadLeveranciers(project.id),
    laadOffertes(project.id),
    laadProjectResultaat(project.id),
  ]);
  const magBewerken = project.rol !== "lezer";
  const contractLeverancier = new Map(
    invoer.contracten.map((c) => [c.id, c.leverancierId]),
  );

  const rijen = leveranciers.map((l) => {
    const contracten = resultaat.contracten.filter(
      (c) => contractLeverancier.get(c.id) === l.id,
    );
    return {
      ...l,
      offertes: offertes.filter((o) => o.leverancierId === l.id).length,
      contracten: contracten.length,
      prognose: contracten.reduce((a, c) => a + c.prognose, 0),
    };
  });

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        titel="Leveranciers"
        omschrijving="Aannemers, winkels en andere partijen waarmee je zaken doet."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="min-w-0 lg:col-span-7">
          <Card aria-labelledby="lijst-titel" className="overflow-hidden">
            <CardHeader
              id="lijst-titel"
              title={`${rijen.length} ${rijen.length === 1 ? "leverancier" : "leveranciers"}`}
              className="pb-4"
            />
            {rijen.length ? (
              <ul>
                {rijen.map((l) => (
                  <li key={l.id} className="border-border border-t">
                    <Link
                      href={`/leveranciers/${l.id}`}
                      className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3.5 sm:px-6"
                    >
                      <span className="bg-accent-soft text-accent-ink flex size-9 shrink-0 items-center justify-center rounded-full">
                        <Store className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.naam}</p>
                        <p className="text-muted truncate text-xs">
                          {[l.contactpersoon, l.email, l.telefoon]
                            .filter(Boolean)
                            .join(" · ") || "Geen contactgegevens"}
                        </p>
                      </div>
                      <div className="hidden text-right text-xs sm:block">
                        <p className="text-muted">
                          {l.offertes}{" "}
                          {l.offertes === 1 ? "offerte" : "offertes"} ·{" "}
                          {l.contracten}{" "}
                          {l.contracten === 1 ? "contract" : "contracten"}
                        </p>
                        {l.prognose > 0 && (
                          <p className="mt-0.5 text-sm font-medium tabular-nums">
                            {formatEuro(l.prognose, heel)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="text-subtle size-4 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted border-border border-t px-5 py-4 text-sm sm:px-6">
                Nog geen leveranciers. Voeg ze hier toe, of direct bij het
                invoeren van een offerte.
              </p>
            )}
          </Card>
        </div>
        {magBewerken && (
          <div className="min-w-0 lg:col-span-5">
            <Card aria-labelledby="nieuw-titel">
              <CardHeader
                id="nieuw-titel"
                title="Nieuwe leverancier"
                description="Alleen de naam is verplicht."
              />
              <div className="px-5 pt-4 pb-5 sm:px-6">
                <LeverancierFormulier />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
