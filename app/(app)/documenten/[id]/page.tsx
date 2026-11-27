import {
  ChevronRight,
  CircleCheck,
  DoorOpen,
  Pencil,
  Trash2,
  TriangleExclamationPoint,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BestandKaart } from "@/components/bestanden/bestand-kaart";
import {
  BetalingFormulier,
  DocumentStatusActies,
  DocumentVerwijderen,
} from "@/components/documenten/formulieren";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { StatusPill } from "@/components/ui/status";
import { betalingVerwijderen } from "@/lib/acties/documenten";
import { getActiefProject } from "@/lib/auth";
import { BTW_TARIEVEN, isBtwTarief, vanafInclusief } from "@/lib/btw";
import { bestandMetLink } from "@/lib/data/bestanden";
import {
  laadBetaalbronnen,
  laadDocument,
  type DocumentDetails,
} from "@/lib/data/documenten";
import { categorieLabels, laadLeveranciers } from "@/lib/data/offertes";
import { laadProjectResultaat } from "@/lib/data/project";
import { formatDatum, formatEuro } from "@/lib/format";
import { BETAALSTATUS, DOCUMENT_TYPE, STATUS_DOCUMENT } from "@/lib/labels";

const heel = { centen: false } as const;

function titelVan(d: Pick<DocumentDetails, "type" | "nummer" | "datum">) {
  const soort = DOCUMENT_TYPE[d.type].tekst;
  return d.nummer
    ? `${soort} ${d.nummer}`
    : `${soort} van ${formatDatum(d.datum)}`;
}

export async function generateMetadata({
  params,
}: PageProps<"/documenten/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = await laadDocument(id);
  return { title: d ? titelVan(d) : "Document" };
}

function Cijfer({
  label,
  waarde,
  extra,
}: {
  label: string;
  waarde: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-surface shadow-card rounded-2xl border p-4">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight whitespace-nowrap">
        {waarde}
      </p>
      {extra && <div className="text-muted mt-1 text-xs">{extra}</div>}
    </div>
  );
}

export default async function DocumentPagina({
  params,
}: PageProps<"/documenten/[id]">) {
  const { id } = await params;
  const project = await getActiefProject();
  const [document, leveranciers, { invoer, resultaat, vandaag }, bronnen] =
    await Promise.all([
      laadDocument(id),
      laadLeveranciers(project.id),
      laadProjectResultaat(project.id),
      laadBetaalbronnen(project.id),
    ]);
  const cijfers = resultaat.documenten.find((d) => d.id === id);
  if (!document || !cijfers) notFound();
  const bestand = await bestandMetLink(document.bestandId);

  const magBewerken = project.rol !== "lezer";
  const geboekt = document.status === "geboekt";
  const leverancier = leveranciers.find((l) => l.id === document.leverancierId);
  const contract = invoer.contracten.find((c) => c.id === document.contractId);
  const termijn = invoer.termijnen.find((t) => t.id === document.termijnId);
  const labels = categorieLabels(invoer.categorieen);
  const contractRegel = new Map(invoer.contractRegels.map((r) => [r.id, r]));
  const contractTitel = new Map(invoer.contracten.map((c) => [c.id, c.titel]));
  const ruimteNaam = new Map(invoer.ruimtes.map((r) => [r.id, r.naam]));
  const bronNaam = new Map(bronnen.map((b) => [b.id, b.naam]));

  const doelVan = (r: DocumentDetails["regels"][number]) => {
    if (r.contractRegelId) {
      const cr = contractRegel.get(r.contractRegelId);
      return `${contractTitel.get(cr?.contractId ?? "") ?? "Contract"} › ${cr?.omschrijving || "regel"}`;
    }
    if (r.contractId) {
      return `${contractTitel.get(r.contractId) ?? "Contract"} (naar rato${
        r.categorieId ? `, ${labels.get(r.categorieId) ?? ""}` : ""
      })`;
    }
    return r.categorieId
      ? (labels.get(r.categorieId) ?? "Onbekende categorie")
      : "Geen categorie";
  };

  const totaal = document.regels.reduce(
    (a, r) => {
      const b = isBtwTarief(r.btw)
        ? vanafInclusief(r.bedrag, r.btw)
        : { excl: r.bedrag, btw: 0 };
      return { excl: a.excl + b.excl, btw: a.btw + b.btw };
    },
    { excl: 0, btw: 0 },
  );
  const btwLabel = (bp: number) =>
    BTW_TARIEVEN.find((t) => t.bp === bp)?.label ?? `${bp / 100}%`;
  const klopt =
    document.totaalOpDocument === null ||
    document.totaalOpDocument === cijfers.totaal;
  const dagen = cijfers.dagenTotVervallen;

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
        <span className="text-foreground truncate">{titelVan(document)}</span>
      </nav>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
            {titelVan(document)}
          </h1>
          <StatusPill soort={STATUS_DOCUMENT[document.status].soort}>
            {STATUS_DOCUMENT[document.status].tekst}
          </StatusPill>
          {cijfers.betaalStatus && (
            <StatusPill soort={BETAALSTATUS[cijfers.betaalStatus].soort}>
              {BETAALSTATUS[cijfers.betaalStatus].tekst}
            </StatusPill>
          )}
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
          <span>{formatDatum(document.datum)}</span>
          {contract && (
            <Link
              href={`/contracten/${contract.id}`}
              className="hover:text-foreground"
            >
              Contract: {contract.titel}
              {termijn ? ` · termijn ${termijn.volgorde}` : ""}
            </Link>
          )}
        </p>
      </div>

      <section
        aria-label="Kerncijfers"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
      >
        <Cijfer label="Totaal" waarde={formatEuro(cijfers.totaal)} />
        <Cijfer
          label="Betaald"
          waarde={formatEuro(cijfers.betaald)}
          extra={geboekt ? undefined : "pas na boeken"}
        />
        <Cijfer
          label="Openstaand"
          waarde={formatEuro(geboekt ? cijfers.openstaand : 0)}
        />
        <Cijfer
          label="Uiterlijk betalen"
          waarde={
            document.vervalDatum ? formatDatum(document.vervalDatum) : "—"
          }
          extra={
            geboekt && cijfers.openstaand !== 0 && dagen !== null
              ? dagen < 0
                ? `${-dagen} ${dagen === -1 ? "dag" : "dagen"} te laat`
                : dagen === 0
                  ? "vandaag"
                  : `over ${dagen} ${dagen === 1 ? "dag" : "dagen"}`
              : undefined
          }
        />
      </section>

      {!geboekt && document.status !== "vervallen" && (
        <p className="border-warning/30 bg-warning-soft text-warning flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
          <TriangleExclamationPoint className="mt-0.5 size-4 shrink-0" />
          Dit document is nog niet geboekt en telt daarom nog niet mee in je
          cijfers.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="min-w-0 space-y-4 lg:col-span-7 lg:space-y-5">
          <Card aria-labelledby="regels-titel" className="overflow-hidden">
            <CardHeader
              id="regels-titel"
              title="Regels"
              description="Bedragen inclusief BTW."
              className="pb-4"
            />
            {document.regels.length ? (
              <ul>
                {document.regels.map((r, i) => (
                  <li
                    key={r.id}
                    className="border-border flex items-start gap-3 border-t px-5 py-3 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {r.omschrijving || `Regel ${i + 1}`}
                      </p>
                      <p className="text-muted mt-0.5 text-xs">
                        {doelVan(r)} · BTW {btwLabel(r.btw)}
                      </p>
                      {r.ruimteIds.length > 0 && (
                        <p className="text-muted mt-0.5 flex items-center gap-1 text-xs">
                          <DoorOpen className="size-3" />
                          {r.ruimteIds
                            .map((x) => ruimteNaam.get(x) ?? "?")
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatEuro(r.bedrag)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted border-border border-t px-5 py-4 text-sm sm:px-6">
                Nog geen regels.
              </p>
            )}
            <dl className="border-border bg-surface-2 space-y-1 border-t px-5 py-4 text-sm tabular-nums sm:px-6">
              <div className="text-muted flex justify-between gap-4">
                <dt>Totaal excl. BTW</dt>
                <dd>{formatEuro(totaal.excl)}</dd>
              </div>
              <div className="text-muted flex justify-between gap-4">
                <dt>BTW</dt>
                <dd>{formatEuro(totaal.btw)}</dd>
              </div>
              <div className="flex justify-between gap-4 pt-1 font-semibold">
                <dt>Totaal incl. BTW</dt>
                <dd>{formatEuro(cijfers.totaal)}</dd>
              </div>
              {document.totaalOpDocument !== null && (
                <div
                  className={`flex items-center justify-between gap-4 pt-1 text-xs ${klopt ? "text-positive" : "text-warning"}`}
                >
                  <dt className="flex items-center gap-1">
                    {klopt ? (
                      <CircleCheck className="size-3.5" />
                    ) : (
                      <TriangleExclamationPoint className="size-3.5" />
                    )}
                    Totaal op het document
                  </dt>
                  <dd>{formatEuro(document.totaalOpDocument)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <BestandKaart
            bestand={bestand}
            omschrijving={DOCUMENT_TYPE[document.type].tekst}
            toevoegenHref={
              magBewerken && document.status !== "vervallen"
                ? `/documenten/${id}/bewerken`
                : undefined
            }
          />
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5 lg:space-y-5">
          <Card aria-labelledby="status-titel">
            <CardHeader
              id="status-titel"
              title="Status"
              description={
                geboekt && document.geboektOp
                  ? `Geboekt op ${formatDatum(document.geboektOp)}${document.geboektDoor ? ` door ${document.geboektDoor}` : ""}.`
                  : document.status === "vervallen"
                    ? "Vervallen: telt nergens mee."
                    : "Nog niet geboekt."
              }
            />
            {magBewerken && (
              <div className="space-y-3 px-5 pt-4 pb-5 sm:px-6">
                <DocumentStatusActies
                  id={id}
                  status={document.status}
                  heeftBetalingen={document.betalingen.length > 0}
                />
                {document.status !== "vervallen" && (
                  <Link
                    href={`/documenten/${id}/bewerken`}
                    className={knopKlassen("secundair", "px-3 py-2")}
                  >
                    <Pencil className="size-4" />
                    Bewerken
                  </Link>
                )}
              </div>
            )}
          </Card>

          {(geboekt || document.betalingen.length > 0) && (
            <Card
              aria-labelledby="betalingen-titel"
              className="overflow-hidden"
            >
              <CardHeader
                id="betalingen-titel"
                title="Betalingen"
                description={
                  cijfers.openstaand === 0
                    ? "Volledig betaald."
                    : `Nog ${formatEuro(Math.abs(cijfers.openstaand))} ${cijfers.openstaand < 0 ? "terug te ontvangen" : "te betalen"}.`
                }
                className="pb-4"
              />
              {document.betalingen.length > 0 && (
                <ul>
                  {document.betalingen.map((b) => (
                    <li
                      key={b.id}
                      className="border-border flex items-center gap-3 border-t px-5 py-3 sm:px-6"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{formatDatum(b.datum)}</p>
                        <p className="text-muted truncate text-xs">
                          {[b.omschrijving, b.bronId && bronNaam.get(b.bronId)]
                            .filter(Boolean)
                            .join(" · ") || "Betaling"}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums">
                        {formatEuro(b.bedrag)}
                      </span>
                      {magBewerken && (
                        <form action={betalingVerwijderen}>
                          <input type="hidden" name="id" value={b.id} />
                          <button
                            type="submit"
                            className={knopKlassen(
                              "stil",
                              "hover:text-critical -my-1 px-2 py-1.5",
                            )}
                            title="Betaling verwijderen"
                          >
                            <Trash2 className="size-3.5" />
                            <span className="sr-only">
                              Verwijder betaling van {formatDatum(b.datum)}
                            </span>
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {magBewerken && geboekt && cijfers.openstaand !== 0 && (
                <div className="border-border border-t px-5 py-4 sm:px-6">
                  <BetalingFormulier
                    documentId={id}
                    openstaand={cijfers.openstaand}
                    bronnen={bronnen}
                    vandaag={vandaag}
                  />
                </div>
              )}
            </Card>
          )}

          {document.notities && (
            <Card aria-labelledby="notities-titel">
              <CardHeader id="notities-titel" title="Notities" />
              <p className="px-5 pt-3 pb-5 text-sm whitespace-pre-line sm:px-6">
                {document.notities}
              </p>
            </Card>
          )}

          {magBewerken && (
            <Card aria-labelledby="verwijderen-titel">
              <CardHeader id="verwijderen-titel" title="Verwijderen" />
              <div className="px-5 pt-4 pb-5 sm:px-6">
                <DocumentVerwijderen
                  id={id}
                  heeftBetalingen={document.betalingen.length > 0}
                />
              </div>
            </Card>
          )}
          <p className="text-muted px-1 text-xs">
            Totaal {formatEuro(cijfers.totaal, heel)} ·{" "}
            {DOCUMENT_TYPE[document.type].tekst.toLowerCase()} ·{" "}
            {document.bron === "ai"
              ? "voorgesteld door AI"
              : "handmatig ingevoerd"}
          </p>
        </div>
      </div>
    </div>
  );
}
