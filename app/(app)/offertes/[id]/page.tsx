import {
  ArrowRight,
  Ban,
  ChevronRight,
  Clock,
  Pencil,
  RotateCcw,
  TriangleExclamationPoint,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BestandKaart } from "@/components/bestanden/bestand-kaart";
import { Afwijking } from "@/components/budget/categorie-tabel";
import {
  OfferteAccepteren,
  OfferteVerwijderen,
} from "@/components/offertes/formulieren";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { StatusPill } from "@/components/ui/status";
import { offerteStatusWijzigen } from "@/lib/acties/offertes";
import { getActiefProject } from "@/lib/auth";
import { BTW_TARIEVEN, isBtwTarief, vanafInclusief } from "@/lib/btw";
import { bestandMetLink } from "@/lib/data/bestanden";
import {
  categorieLabels,
  laadLeveranciers,
  laadOffertes,
} from "@/lib/data/offertes";
import { laadProjectResultaat } from "@/lib/data/project";
import { berekenProject, metExtraContract } from "@/lib/finance";
import { formatDatum, formatEuro } from "@/lib/format";
import { STATUS_OFFERTE } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const heel = { centen: false } as const;

export async function generateMetadata({
  params,
}: PageProps<"/offertes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const project = await getActiefProject();
  const o = (await laadOffertes(project.id)).find((x) => x.id === id);
  return { title: o?.titel ?? "Offerte" };
}

export default async function OffertePagina({
  params,
}: PageProps<"/offertes/[id]">) {
  const { id } = await params;
  const project = await getActiefProject();
  const [offertes, leveranciers, { invoer, resultaat, vandaag }] =
    await Promise.all([
      laadOffertes(project.id),
      laadLeveranciers(project.id),
      laadProjectResultaat(project.id),
    ]);
  const offerte = offertes.find((o) => o.id === id);
  if (!offerte) notFound();

  const supabase = await createClient();
  const [bestand, { data: contract }] = await Promise.all([
    bestandMetLink(offerte.bestandId),
    supabase
      .from("contracts")
      .select("id, title")
      .eq("quote_id", id)
      .maybeSingle(),
  ]);

  const magBewerken = project.rol !== "lezer";
  const geaccepteerd = offerte.status === "geaccepteerd";
  const leverancier = leveranciers.find((l) => l.id === offerte.leverancierId);
  const labels = categorieLabels(invoer.categorieen);
  const zonderCategorie = offerte.regels.filter((r) => !r.categorieId).length;
  const verlopen =
    offerte.status === "ontvangen" &&
    offerte.geldigTot !== null &&
    offerte.geldigTot < vandaag;

  const totaal = offerte.regels.reduce(
    (a, r) => {
      const b = isBtwTarief(r.btw)
        ? vanafInclusief(r.bedrag, r.btw)
        : { excl: r.bedrag, btw: 0, incl: r.bedrag };
      return { excl: a.excl + b.excl, btw: a.btw + b.btw };
    },
    { excl: 0, btw: 0 },
  );

  // Wat doet accepteren met de prognose? (alleen zolang nog niet besloten)
  const effect =
    !geaccepteerd && zonderCategorie === 0
      ? (() => {
          const na = berekenProject(
            metExtraContract(invoer, offerte.regels, offerte.leverancierId),
            { vandaag },
          );
          const ids = [...new Set(offerte.regels.map((r) => r.categorieId))];
          return {
            regels: ids.flatMap((cid) => {
              const voor = resultaat.categorieen.find((c) => c.id === cid);
              const daarna = na.categorieen.find((c) => c.id === cid);
              if (!cid || !voor || !daarna) return [];
              return [
                {
                  id: cid,
                  label: labels.get(cid) ?? voor.naam,
                  budget: voor.cijfers.budget,
                  nu: voor.cijfers.prognose,
                  na: daarna.cijfers.prognose,
                  afgesloten: voor.afgesloten,
                },
              ];
            }),
            totaalNu: resultaat.cijfers.prognose,
            totaalNa: na.cijfers.prognose,
          };
        })()
      : null;

  const btwLabel = (bp: number) =>
    BTW_TARIEVEN.find((t) => t.bp === bp)?.label ?? `${bp / 100}%`;

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link href="/offertes" className="hover:text-foreground">
          Offertes
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="text-foreground truncate">{offerte.titel}</span>
      </nav>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
            {offerte.titel}
          </h1>
          <StatusPill soort={STATUS_OFFERTE[offerte.status].soort}>
            {STATUS_OFFERTE[offerte.status].tekst}
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
          {offerte.nummer && <span>Nr. {offerte.nummer}</span>}
          {offerte.datum && <span>{formatDatum(offerte.datum)}</span>}
          {offerte.geldigTot && (
            <span className={verlopen ? "text-warning font-medium" : ""}>
              {verlopen ? "Was geldig tot" : "Geldig tot"}{" "}
              {formatDatum(offerte.geldigTot)}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="min-w-0 space-y-4 lg:col-span-7 lg:space-y-5">
          {/* Regels */}
          <Card aria-labelledby="regels-titel" className="overflow-hidden">
            <CardHeader
              id="regels-titel"
              title="Regels"
              description="Bedragen inclusief BTW."
              className="pb-4"
            />
            <ul>
              {offerte.regels.map((r) => (
                <li
                  key={r.id}
                  className="border-border flex items-start gap-3 border-t px-5 py-3 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {r.omschrijving || (
                        <span className="text-muted">Zonder omschrijving</span>
                      )}
                    </p>
                    <p className="text-muted mt-0.5 text-xs">
                      {r.categorieId ? (
                        (labels.get(r.categorieId) ?? "Onbekende categorie")
                      ) : (
                        <span className="text-warning font-medium">
                          Geen categorie
                        </span>
                      )}{" "}
                      · BTW {btwLabel(r.btw)}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {formatEuro(r.bedrag)}
                  </span>
                </li>
              ))}
            </ul>
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
                <dd>{formatEuro(offerte.totaal)}</dd>
              </div>
            </dl>
          </Card>

          <BestandKaart
            bestand={bestand}
            omschrijving="Offerte"
            toevoegenHref={
              magBewerken && !geaccepteerd
                ? `/offertes/${id}/bewerken`
                : undefined
            }
          />
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5 lg:space-y-5">
          {/* Contract of accepteren */}
          {geaccepteerd ? (
            <Card aria-labelledby="contract-titel">
              <CardHeader
                id="contract-titel"
                title="Contract"
                description="Deze offerte is geaccepteerd. Het contract telt mee in de prognose van je budget."
              />
              <div className="px-5 pt-4 pb-5 sm:px-6">
                {contract ? (
                  <Link
                    href={`/contracten/${contract.id}`}
                    className={knopKlassen("primair")}
                  >
                    Naar {contract.title}
                    <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <p className="text-muted text-sm">
                    Het contract is niet (meer) gevonden.
                  </p>
                )}
              </div>
            </Card>
          ) : (
            magBewerken && (
              <Card aria-labelledby="accepteren-titel">
                <CardHeader
                  id="accepteren-titel"
                  title="Accepteren"
                  description="Er wordt een contract gemaakt met dezelfde regels. Vanaf dat moment telt het bedrag mee in je budget."
                />
                <div className="space-y-4 px-5 pt-4 pb-5 sm:px-6">
                  {offerte.status !== "ontvangen" ? (
                    <p className="text-muted text-sm">
                      Zet de offerte eerst terug naar &quot;Ontvangen&quot; om
                      hem te accepteren.
                    </p>
                  ) : zonderCategorie > 0 ? (
                    <div className="bg-warning-soft text-warning flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm">
                      <TriangleExclamationPoint className="mt-0.5 size-4 shrink-0" />
                      <p>
                        {zonderCategorie === 1
                          ? "Eén regel heeft"
                          : `${zonderCategorie} regels hebben`}{" "}
                        nog geen categorie.{" "}
                        <Link
                          href={`/offertes/${id}/bewerken`}
                          className="font-semibold underline"
                        >
                          Geef elke regel een categorie
                        </Link>{" "}
                        om de offerte te accepteren.
                      </p>
                    </div>
                  ) : (
                    <>
                      {effect && (
                        <div>
                          <p className="mb-2 text-sm font-medium">
                            Effect op de prognose
                          </p>
                          <div className="border-border overflow-hidden rounded-xl border">
                            <table className="w-full text-sm tabular-nums">
                              <caption className="sr-only">
                                Prognose per categorie nu en na accepteren
                              </caption>
                              <thead className="bg-surface-2 text-muted text-xs">
                                <tr>
                                  <th
                                    scope="col"
                                    className="px-3 py-2 text-left font-medium"
                                  >
                                    Categorie
                                  </th>
                                  <th
                                    scope="col"
                                    className="px-3 py-2 text-right font-medium"
                                  >
                                    Nu
                                  </th>
                                  <th
                                    scope="col"
                                    className="px-3 py-2 text-right font-medium"
                                  >
                                    Daarna
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {effect.regels.map((e) => (
                                  <tr
                                    key={e.id}
                                    className="border-border border-t"
                                  >
                                    <th
                                      scope="row"
                                      className="px-3 py-2 text-left font-normal"
                                    >
                                      <span className="block">{e.label}</span>
                                      <span className="text-muted text-xs">
                                        budget {formatEuro(e.budget, heel)}
                                      </span>
                                    </th>
                                    <td className="px-3 py-2 text-right">
                                      {formatEuro(e.nu, heel)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium">
                                      {formatEuro(e.na, heel)}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="border-border bg-surface-2 border-t">
                                  <th
                                    scope="row"
                                    className="px-3 py-2 text-left font-medium"
                                  >
                                    Hele project
                                  </th>
                                  <td className="px-3 py-2 text-right">
                                    {formatEuro(effect.totaalNu, heel)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold">
                                    {formatEuro(effect.totaalNa, heel)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <p className="text-muted mt-2 flex flex-wrap items-center gap-2 text-xs">
                            Verschil voor het project:
                            <Afwijking
                              bedrag={effect.totaalNa - effect.totaalNu}
                            />
                          </p>
                          {effect.regels.some((e) => e.na === e.nu) && (
                            <p className="text-muted mt-1.5 text-xs leading-relaxed">
                              Valt een offerte binnen het budget van een open
                              categorie, dan blijft de prognose gelijk aan het
                              budget. Een meevaller zie je pas na afsluiten.
                            </p>
                          )}
                        </div>
                      )}
                      <OfferteAccepteren id={id} titel={offerte.titel} />
                    </>
                  )}
                </div>
              </Card>
            )
          )}

          {/* Status */}
          {magBewerken && !geaccepteerd && (
            <Card aria-labelledby="status-titel">
              <CardHeader
                id="status-titel"
                title="Status"
                description="Een afgewezen of verlopen offerte doet niet meer mee in de vergelijking."
              />
              <div className="flex flex-wrap gap-2 px-5 pt-4 pb-5 sm:px-6">
                {offerte.status === "ontvangen" ? (
                  <>
                    <form action={offerteStatusWijzigen}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="status" value="afgewezen" />
                      <button
                        type="submit"
                        className={knopKlassen("secundair", "px-3 py-2")}
                      >
                        <Ban className="size-4" />
                        Afwijzen
                      </button>
                    </form>
                    <form action={offerteStatusWijzigen}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="status" value="verlopen" />
                      <button
                        type="submit"
                        className={knopKlassen("secundair", "px-3 py-2")}
                      >
                        <Clock className="size-4" />
                        Verlopen
                      </button>
                    </form>
                  </>
                ) : (
                  <form action={offerteStatusWijzigen}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="status" value="ontvangen" />
                    <button
                      type="submit"
                      className={knopKlassen("secundair", "px-3 py-2")}
                    >
                      <RotateCcw className="size-4" />
                      Terug naar ontvangen
                    </button>
                  </form>
                )}
                <Link
                  href={`/offertes/${id}/bewerken`}
                  className={knopKlassen("secundair", "px-3 py-2")}
                >
                  <Pencil className="size-4" />
                  Bewerken
                </Link>
              </div>
            </Card>
          )}

          {offerte.notities && (
            <Card aria-labelledby="notities-titel">
              <CardHeader id="notities-titel" title="Notities" />
              <p className="px-5 pt-3 pb-5 text-sm whitespace-pre-line sm:px-6">
                {offerte.notities}
              </p>
            </Card>
          )}

          {magBewerken && !geaccepteerd && (
            <Card aria-labelledby="verwijderen-titel">
              <CardHeader
                id="verwijderen-titel"
                title="Verwijderen"
                description="Het document wordt ook verwijderd, tenzij het nog bij een ander stuk hoort."
              />
              <div className="px-5 pt-4 pb-5 sm:px-6">
                <OfferteVerwijderen id={id} titel={offerte.titel} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
