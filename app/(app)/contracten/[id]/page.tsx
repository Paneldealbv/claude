import {
  Check,
  ChevronRight,
  FileText,
  RotateCcw,
  Trash2,
  TriangleExclamationPoint,
  X,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContractGegevens,
  ContractRegels,
  ContractStatus,
  ContractVerwijderen,
  TermijnFormulier,
  WijzigingFormulier,
} from "@/components/contracten/formulieren";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { StatusPill } from "@/components/ui/status";
import {
  termijnVerwijderen,
  wijzigingBesluiten,
  wijzigingVerwijderen,
} from "@/lib/acties/contracten";
import { getActiefProject } from "@/lib/auth";
import { laadContract } from "@/lib/data/contracten";
import {
  categorieLabels,
  categorieOpties,
  laadLeveranciers,
} from "@/lib/data/offertes";
import { laadProjectResultaat } from "@/lib/data/project";
import { formatDatum, formatEuro, formatEuroVerschil } from "@/lib/format";
import {
  STATUS_CONTRACT,
  STATUS_TERMIJN,
  STATUS_WIJZIGING,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const heel = { centen: false } as const;

export async function generateMetadata({
  params,
}: PageProps<"/contracten/[id]">): Promise<Metadata> {
  const { id } = await params;
  const contract = await laadContract(id);
  return { title: contract?.titel ?? "Contract" };
}

function Cijfer({
  label,
  waarde,
  extra,
}: {
  label: string;
  waarde: number;
  extra?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-surface shadow-card rounded-2xl border p-4">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight whitespace-nowrap">
        {formatEuro(waarde, heel)}
      </p>
      {extra && <div className="text-muted mt-1 text-xs">{extra}</div>}
    </div>
  );
}

function BesluitKnop({
  id,
  besluit,
  children,
}: {
  id: string;
  besluit: "akkoord" | "afgewezen" | "voorgesteld";
  children: React.ReactNode;
}) {
  return (
    <form action={wijzigingBesluiten}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="besluit" value={besluit} />
      <button
        type="submit"
        className={knopKlassen(
          besluit === "akkoord" ? "primair" : "secundair",
          "px-2.5 py-1.5 text-xs",
        )}
      >
        {children}
      </button>
    </form>
  );
}

export default async function ContractPagina({
  params,
}: PageProps<"/contracten/[id]">) {
  const { id } = await params;
  const project = await getActiefProject();
  const [contract, leveranciers, { invoer, resultaat }] = await Promise.all([
    laadContract(id),
    laadLeveranciers(project.id),
    laadProjectResultaat(project.id),
  ]);
  const cijfers = resultaat.contracten.find((c) => c.id === id);
  if (!contract || !cijfers) notFound();

  const supabase = await createClient();
  const { data: offerte } = contract.offerteId
    ? await supabase
        .from("quotes")
        .select("id, title")
        .eq("id", contract.offerteId)
        .maybeSingle()
    : { data: null };

  const magBewerken = project.rol !== "lezer";
  const leverancier = leveranciers.find((l) => l.id === contract.leverancierId);
  const labels = categorieLabels(invoer.categorieen);
  const ruimtes = [...invoer.ruimtes]
    .sort((a, b) => a.volgorde - b.volgorde)
    .map((r) => ({ id: r.id, naam: r.naam }));

  const perRegel = new Map(cijfers.regels.map((r) => [r.id, r]));
  const regels = contract.regels.map((r) => {
    const c = perRegel.get(r.id);
    return {
      id: r.id,
      omschrijving: r.omschrijving,
      categorieId: r.categorieId,
      categorie: labels.get(r.categorieId) ?? "Onbekende categorie",
      bedrag: r.bedrag,
      btw: r.btw,
      gecontracteerd: c?.gecontracteerd ?? 0,
      gefactureerd: c?.gefactureerd ?? 0,
      prognose: c?.prognose ?? 0,
      gekoppeldeKosten: r.gekoppeldeKosten,
      ruimteIds: invoer.ruimteVerdelingen
        .filter((v) => v.contractRegelId === r.id)
        .map((v) => v.ruimteId),
    };
  });
  const regelLabel = new Map(
    regels.map((r, i) => [r.id, r.omschrijving || `Regel ${i + 1}`]),
  );

  const somWijziging = (status: "akkoord" | "voorgesteld") =>
    contract.wijzigingen
      .filter((w) => w.status === status)
      .reduce((a, w) => a + w.bedrag, 0);
  const goedgekeurd = somWijziging("akkoord");
  const voorgesteld = somWijziging("voorgesteld");

  const termijnInfo = new Map(contract.termijnen.map((t) => [t.id, t]));
  const somPercentage = contract.termijnen.reduce(
    (a, t) => a + (t.percentageBp ?? 0),
    0,
  );
  const alleenPercentages = contract.termijnen.every(
    (t) => t.percentageBp !== null,
  );
  const ingepland = cijfers.termijnen.reduce((a, t) => a + t.verwachtBedrag, 0);
  const geannuleerd = contract.status === "geannuleerd";

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link href="/contracten" className="hover:text-foreground">
          Contracten
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="text-foreground truncate">{contract.titel}</span>
      </nav>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
            {contract.titel}
          </h1>
          <StatusPill soort={STATUS_CONTRACT[contract.status].soort}>
            {STATUS_CONTRACT[contract.status].tekst}
          </StatusPill>
        </div>
        <p className="text-muted flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {leverancier ? (
            <Link
              href={`/leveranciers/${leverancier.id}`}
              className="text-accent-ink font-medium hover:underline"
            >
              {leverancier.naam}
            </Link>
          ) : (
            <span>Geen leverancier</span>
          )}
          {contract.getekendOp && (
            <span>Getekend op {formatDatum(contract.getekendOp)}</span>
          )}
          {offerte && (
            <Link
              href={`/offertes/${offerte.id}`}
              className="hover:text-foreground inline-flex items-center gap-1"
            >
              <FileText className="size-3.5" />
              Offerte: {offerte.title}
            </Link>
          )}
        </p>
      </div>

      <section
        aria-label="Kerncijfers"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
      >
        <Cijfer
          label="Gecontracteerd"
          waarde={cijfers.gecontracteerd}
          extra={
            goedgekeurd !== 0
              ? `incl. ${formatEuroVerschil(goedgekeurd, heel)} meer-/minderwerk`
              : "volgens afspraak"
          }
        />
        <Cijfer
          label="Gefactureerd"
          waarde={cijfers.gefactureerd}
          extra={`nog ${formatEuro(cijfers.nogTeFactureren, heel)} te factureren`}
        />
        <Cijfer label="Betaald" waarde={cijfers.betaald} />
        <Cijfer
          label="Prognose"
          waarde={cijfers.prognose}
          extra={
            geannuleerd
              ? "geannuleerd: alleen gefactureerd telt"
              : cijfers.overschrijding > 0
                ? `${formatEuroVerschil(cijfers.overschrijding, heel)} boven het contract`
                : "telt mee in je budget"
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="min-w-0 space-y-4 lg:col-span-7 lg:space-y-5">
          {/* Regels */}
          <Card aria-labelledby="regels-titel" className="overflow-hidden">
            <CardHeader
              id="regels-titel"
              title="Regels"
              description="Per regel: afspraak plus goedgekeurd meer-/minderwerk, wat er gefactureerd is en de prognose."
              className="pb-4"
            />
            <ContractRegels
              contractId={id}
              regels={regels}
              categorieen={categorieOpties(invoer.categorieen)}
              ruimtes={ruimtes}
              magBewerken={magBewerken}
            />
          </Card>

          {/* Meer- en minderwerk */}
          <Card aria-labelledby="wijzigingen-titel" className="overflow-hidden">
            <CardHeader
              id="wijzigingen-titel"
              title="Meer- en minderwerk"
              description="Telt pas mee in de prognose als je akkoord geeft."
              className="pb-4"
            />
            {contract.wijzigingen.length > 0 && (
              <ul>
                {contract.wijzigingen.map((w) => (
                  <li
                    key={w.id}
                    className="border-border border-t px-5 py-3 sm:px-6"
                  >
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="text-sm font-medium">{w.omschrijving}</p>
                        <p className="text-muted text-xs">
                          {regelLabel.get(w.contractRegelId) ?? "Regel"}
                          {w.besloten &&
                            ` · ${w.status === "akkoord" ? "akkoord" : "afgewezen"} op ${formatDatum(w.besloten)}`}
                        </p>
                      </div>
                      <StatusPill soort={STATUS_WIJZIGING[w.status].soort}>
                        {STATUS_WIJZIGING[w.status].tekst}
                      </StatusPill>
                      <span
                        className={
                          w.status === "afgewezen"
                            ? "text-muted text-sm tabular-nums line-through"
                            : "text-sm font-medium tabular-nums"
                        }
                      >
                        {formatEuroVerschil(w.bedrag)}
                      </span>
                    </div>
                    {magBewerken && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {w.status === "voorgesteld" ? (
                          <>
                            <BesluitKnop id={w.id} besluit="akkoord">
                              <Check className="size-3.5" />
                              Akkoord
                            </BesluitKnop>
                            <BesluitKnop id={w.id} besluit="afgewezen">
                              <X className="size-3.5" />
                              Afwijzen
                            </BesluitKnop>
                          </>
                        ) : (
                          <BesluitKnop id={w.id} besluit="voorgesteld">
                            <RotateCcw className="size-3.5" />
                            Terug naar voorstel
                          </BesluitKnop>
                        )}
                        {w.status !== "akkoord" && (
                          <form action={wijzigingVerwijderen}>
                            <input type="hidden" name="id" value={w.id} />
                            <button
                              type="submit"
                              className={knopKlassen(
                                "stil",
                                "hover:text-critical px-2.5 py-1.5 text-xs",
                              )}
                            >
                              <Trash2 className="size-3.5" />
                              Verwijderen
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="border-border bg-surface-2 flex flex-wrap gap-x-6 gap-y-1 border-t px-5 py-3 text-sm tabular-nums sm:px-6">
              <p>
                <span className="text-muted">Goedgekeurd </span>
                <span className="font-medium">
                  {formatEuroVerschil(goedgekeurd)}
                </span>
              </p>
              <p>
                <span className="text-muted">Voorgesteld </span>
                <span className="font-medium">
                  {formatEuroVerschil(voorgesteld)}
                </span>
                {voorgesteld !== 0 && (
                  <span className="text-muted"> (telt nog niet mee)</span>
                )}
              </p>
            </div>
            {magBewerken && !geannuleerd && (
              <div className="border-border border-t px-5 py-4 sm:px-6">
                <WijzigingFormulier
                  contractId={id}
                  regels={regels.map((r) => ({
                    id: r.id,
                    label: `${regelLabel.get(r.id)} (${r.categorie})`,
                  }))}
                />
              </div>
            )}
          </Card>

          {/* Termijnschema */}
          <Card aria-labelledby="termijnen-titel" className="overflow-hidden">
            <CardHeader
              id="termijnen-titel"
              title="Termijnschema"
              description="Hoe het contract wordt gefactureerd. Termijnfacturen tellen binnen het contract, nooit erbovenop."
              className="pb-4"
            />
            {cijfers.termijnen.length > 0 && (
              <ol>
                {cijfers.termijnen.map((t) => {
                  const info = termijnInfo.get(t.id);
                  return (
                    <li
                      key={t.id}
                      className="border-border flex flex-wrap items-start gap-x-3 gap-y-1 border-t px-5 py-3 sm:px-6"
                    >
                      <span className="bg-surface-2 text-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
                        {t.volgorde}
                      </span>
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="text-sm font-medium">{t.omschrijving}</p>
                        <p className="text-muted text-xs">
                          {info?.percentageBp != null
                            ? `${String(info.percentageBp / 100).replace(".", ",")}% van het contract`
                            : "Vast bedrag"}
                          {t.verwachteDatum &&
                            ` · verwacht ${formatDatum(t.verwachteDatum)}`}
                          {t.gefactureerd !== 0 &&
                            ` · ${formatEuro(t.gefactureerd)} gefactureerd`}
                        </p>
                      </div>
                      <StatusPill soort={STATUS_TERMIJN[t.status].soort}>
                        {STATUS_TERMIJN[t.status].tekst}
                      </StatusPill>
                      <span className="text-sm font-medium tabular-nums">
                        {formatEuro(t.verwachtBedrag)}
                      </span>
                      {magBewerken && (
                        <form action={termijnVerwijderen}>
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            className={knopKlassen(
                              "stil",
                              "hover:text-critical -my-1 px-2 py-1.5",
                            )}
                            title="Termijn verwijderen"
                          >
                            <Trash2 className="size-3.5" />
                            <span className="sr-only">
                              Verwijder termijn {t.volgorde}
                            </span>
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {cijfers.termijnen.length > 0 && (
              <div className="border-border bg-surface-2 border-t px-5 py-3 text-sm sm:px-6">
                <p className="tabular-nums">
                  <span className="text-muted">Ingepland </span>
                  <span className="font-medium">{formatEuro(ingepland)}</span>
                  <span className="text-muted">
                    {" "}
                    van {formatEuro(cijfers.gecontracteerd)}
                    {alleenPercentages &&
                      ` (${String(somPercentage / 100).replace(".", ",")}%)`}
                  </span>
                </p>
                {ingepland !== cijfers.gecontracteerd && (
                  <p className="text-warning mt-1 flex items-start gap-1.5 text-xs font-medium">
                    <TriangleExclamationPoint className="mt-px size-3.5 shrink-0" />
                    {ingepland < cijfers.gecontracteerd
                      ? `Nog ${formatEuro(cijfers.gecontracteerd - ingepland)} niet ingepland.`
                      : `${formatEuro(ingepland - cijfers.gecontracteerd)} meer ingepland dan het contract.`}
                  </p>
                )}
              </div>
            )}
            {magBewerken && !geannuleerd && (
              <div className="border-border border-t px-5 py-4 sm:px-6">
                <TermijnFormulier
                  contractId={id}
                  restPercentage={
                    alleenPercentages ? 10_000 - somPercentage : null
                  }
                />
              </div>
            )}
            {!magBewerken && cijfers.termijnen.length === 0 && (
              <p className="text-muted border-border border-t px-5 py-4 text-sm sm:px-6">
                Geen termijnschema.
              </p>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5 lg:space-y-5">
          {magBewerken && (
            <Card aria-labelledby="status-titel">
              <CardHeader id="status-titel" title="Status" />
              <div className="px-5 pt-4 pb-5 sm:px-6">
                <ContractStatus
                  id={id}
                  status={contract.status}
                  nogTeFactureren={cijfers.nogTeFactureren}
                />
              </div>
            </Card>
          )}

          <Card aria-labelledby="gegevens-titel">
            <CardHeader id="gegevens-titel" title="Gegevens" />
            <div className="px-5 pt-4 pb-5 sm:px-6">
              {magBewerken ? (
                <ContractGegevens
                  contract={contract}
                  leveranciers={leveranciers}
                />
              ) : (
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted text-xs">Leverancier</dt>
                    <dd>{leverancier?.naam ?? "Geen"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs">Getekend op</dt>
                    <dd>
                      {contract.getekendOp
                        ? formatDatum(contract.getekendOp)
                        : "Onbekend"}
                    </dd>
                  </div>
                  {contract.notities && (
                    <div>
                      <dt className="text-muted text-xs">Notities</dt>
                      <dd className="whitespace-pre-line">
                        {contract.notities}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </Card>

          {magBewerken && (
            <Card aria-labelledby="verwijderen-titel">
              <CardHeader id="verwijderen-titel" title="Verwijderen" />
              <div className="px-5 pt-4 pb-5 sm:px-6">
                {contract.regels.some((r) => r.gekoppeldeKosten > 0) ? (
                  <p className="text-muted text-sm">
                    Aan dit contract hangen facturen of bonnen. Annuleer het
                    contract in plaats van het te verwijderen.
                  </p>
                ) : (
                  <ContractVerwijderen
                    id={id}
                    titel={contract.titel}
                    vanOfferte={Boolean(contract.offerteId)}
                  />
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
