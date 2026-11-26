import { ChevronRight, FileText, Handshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LeverancierFormulier,
  LeverancierVerwijderen,
} from "@/components/leveranciers/formulieren";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { StatusPill } from "@/components/ui/status";
import { getActiefProject } from "@/lib/auth";
import { laadLeveranciers, laadOffertes } from "@/lib/data/offertes";
import { laadProjectResultaat } from "@/lib/data/project";
import { STATUS_CONTRACT, STATUS_OFFERTE } from "@/lib/labels";
import { formatDatum, formatEuro } from "@/lib/format";

const heel = { centen: false } as const;

export async function generateMetadata({
  params,
}: PageProps<"/leveranciers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const project = await getActiefProject();
  const l = (await laadLeveranciers(project.id)).find((x) => x.id === id);
  return { title: l?.naam ?? "Leverancier" };
}

export default async function LeverancierPagina({
  params,
}: PageProps<"/leveranciers/[id]">) {
  const { id } = await params;
  const project = await getActiefProject();
  const [leveranciers, offertes, { invoer, resultaat }] = await Promise.all([
    laadLeveranciers(project.id),
    laadOffertes(project.id),
    laadProjectResultaat(project.id),
  ]);
  const leverancier = leveranciers.find((l) => l.id === id);
  if (!leverancier) notFound();
  const magBewerken = project.rol !== "lezer";

  const contractIds = new Set(
    invoer.contracten.filter((c) => c.leverancierId === id).map((c) => c.id),
  );
  const contracten = resultaat.contracten.filter((c) => contractIds.has(c.id));
  const eigenOffertes = offertes.filter((o) => o.leverancierId === id);
  const som = (
    veld: "gecontracteerd" | "gefactureerd" | "betaald" | "prognose",
  ) => contracten.reduce((a, c) => a + c[veld], 0);

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link href="/leveranciers" className="hover:text-foreground">
          Leveranciers
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground truncate">{leverancier.naam}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
          {leverancier.naam}
        </h1>
        {magBewerken && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/offertes/nieuw?leverancier=${id}`}
              className={knopKlassen("secundair")}
            >
              <FileText className="size-4" />
              Nieuwe offerte
            </Link>
            <Link
              href={`/contracten/nieuw?leverancier=${id}`}
              className={knopKlassen("secundair")}
            >
              <Handshake className="size-4" />
              Nieuw contract
            </Link>
          </div>
        )}
      </div>

      <section
        aria-label="Kerncijfers"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
      >
        {(
          [
            ["Gecontracteerd", som("gecontracteerd")],
            ["Gefactureerd", som("gefactureerd")],
            ["Betaald", som("betaald")],
            ["Prognose", som("prognose")],
          ] as const
        ).map(([label, waarde]) => (
          <div
            key={label}
            className="border-border bg-surface shadow-card rounded-2xl border p-4"
          >
            <p className="text-muted text-xs">{label}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight">
              {formatEuro(waarde, heel)}
            </p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="min-w-0 space-y-4 lg:col-span-7 lg:space-y-5">
          <Card aria-labelledby="contracten-titel" className="overflow-hidden">
            <CardHeader
              id="contracten-titel"
              title="Contracten"
              className="pb-4"
            />
            {contracten.length ? (
              <ul>
                {contracten.map((c) => (
                  <li key={c.id} className="border-border border-t">
                    <Link
                      href={`/contracten/${c.id}`}
                      className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3 sm:px-6"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {c.titel}
                      </span>
                      <StatusPill soort={STATUS_CONTRACT[c.status].soort}>
                        {STATUS_CONTRACT[c.status].tekst}
                      </StatusPill>
                      <span className="text-sm tabular-nums">
                        {formatEuro(c.prognose, heel)}
                      </span>
                      <ChevronRight className="text-subtle size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted border-border border-t px-5 py-4 text-sm sm:px-6">
                Nog geen contracten.
              </p>
            )}
          </Card>
          <Card aria-labelledby="offertes-titel" className="overflow-hidden">
            <CardHeader id="offertes-titel" title="Offertes" className="pb-4" />
            {eigenOffertes.length ? (
              <ul>
                {eigenOffertes.map((o) => (
                  <li key={o.id} className="border-border border-t">
                    <Link
                      href={`/offertes/${o.id}`}
                      className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3 sm:px-6"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {o.titel}
                        </p>
                        <p className="text-muted text-xs">
                          {[o.nummer, o.datum && formatDatum(o.datum)]
                            .filter(Boolean)
                            .join(" · ") || "Zonder nummer"}
                        </p>
                      </div>
                      <StatusPill soort={STATUS_OFFERTE[o.status].soort}>
                        {STATUS_OFFERTE[o.status].tekst}
                      </StatusPill>
                      <span className="text-sm tabular-nums">
                        {formatEuro(o.totaal, heel)}
                      </span>
                      <ChevronRight className="text-subtle size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted border-border border-t px-5 py-4 text-sm sm:px-6">
                Nog geen offertes.
              </p>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5 lg:space-y-5">
          <Card aria-labelledby="gegevens-titel">
            <CardHeader id="gegevens-titel" title="Gegevens" />
            <div className="px-5 pt-4 pb-5 sm:px-6">
              <LeverancierFormulier
                leverancier={leverancier}
                magBewerken={magBewerken}
              />
            </div>
          </Card>
          {magBewerken && (
            <Card aria-labelledby="verwijderen-titel">
              <CardHeader id="verwijderen-titel" title="Verwijderen" />
              <div className="px-5 pt-4 pb-5 sm:px-6">
                {contracten.length || eigenOffertes.length ? (
                  <p className="text-muted text-sm">
                    Deze leverancier heeft offertes of contracten; die blijven
                    bewaard. Verwijderen kan daarom niet.
                  </p>
                ) : (
                  <LeverancierVerwijderen id={id} naam={leverancier.naam} />
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
