import { Landmark, PiggyBank, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BetalingenZonderBron } from "@/components/financiering/formulieren";
import { BronnenKaart, DepotKaart } from "@/components/financiering/overzicht";
import { Card, CardHeader } from "@/components/ui/card";
import { Melding } from "@/components/ui/form";
import { knopKlassen } from "@/components/ui/knop";
import { PageHeader } from "@/components/ui/page-header";
import { Tegel } from "@/components/ui/tegel";
import { getActiefProject } from "@/lib/auth";
import { betaalbronnen, laadFinanciering } from "@/lib/data/financiering";
import { formatEuro } from "@/lib/format";

export const metadata: Metadata = { title: "Financiering" };

export default async function FinancieringPagina({
  searchParams,
}: PageProps<"/financiering">) {
  const gekoppeld = Number((await searchParams).gekoppeld ?? NaN);
  const project = await getActiefProject();
  const { cijfers, bronnen, depots, zonderBron } = await laadFinanciering(
    project.id,
  );
  const magBewerken = project.rol !== "lezer";

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        titel="Financiering"
        omschrijving="Waarmee je de bouw betaalt: eigen geld, hypotheek met bouwdepot en andere bronnen. Het bouwdepot is een deel van de hypotheek, geen extra geld."
        actie={
          magBewerken &&
          bronnen.length > 0 && (
            <Link href="/financiering/nieuw" className={knopKlassen("primair")}>
              <Plus className="size-4" />
              Bron toevoegen
            </Link>
          )
        }
      />

      {Number.isInteger(gekoppeld) && gekoppeld > 0 && (
        <Melding soort="succes">
          {gekoppeld} {gekoppeld === 1 ? "betaling" : "betalingen"} gekoppeld.
        </Melding>
      )}

      {bronnen.length === 0 ? (
        <Card>
          <div className="space-y-4 p-5 sm:p-6">
            <div>
              <h2 className="font-semibold">
                Nog geen financiering vastgelegd
              </h2>
              <p className="text-muted mt-1 max-w-2xl text-sm leading-relaxed">
                Leg vast waarmee je bouwt. Een hypotheek met bouwdepot is één
                bron: het bouwdepot is het deel waaruit de bank de bouwfacturen
                betaalt. Daarna zie je per bron wat er betaald is en wat er
                overblijft, en op het dashboard je financiële ruimte.
              </p>
            </div>
            {magBewerken && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/financiering/nieuw?type=hypotheek"
                  className={knopKlassen("primair")}
                >
                  <Landmark className="size-4" />
                  Hypotheek toevoegen
                </Link>
                <Link
                  href="/financiering/nieuw?type=eigen_geld"
                  className={knopKlassen("secundair")}
                >
                  <PiggyBank className="size-4" />
                  Eigen geld toevoegen
                </Link>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <>
          <section
            aria-label="Kerncijfers"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <Tegel
              label="Totale financiering"
              waarde={formatEuro(cijfers.totaal, { centen: false })}
              extra="Bouwdepot telt niet extra mee"
            />
            <Tegel
              label="Prognose eindkosten"
              waarde={formatEuro(cijfers.prognose, { centen: false })}
            />
            <Tegel
              label={cijfers.ruimte < 0 ? "Tekort" : "Financiële ruimte"}
              waarde={formatEuro(Math.abs(cijfers.ruimte), {
                centen: false,
              })}
              extra={
                cijfers.ruimte < 0
                  ? "De prognose is hoger dan de financiering"
                  : "Financiering min prognose"
              }
              kritiek={cijfers.ruimte < 0}
              positief={cijfers.ruimte > 0}
            />
            <Tegel
              label="Nog beschikbaar"
              waarde={formatEuro(cijfers.beschikbaarNaBetalingen, {
                centen: false,
              })}
              extra={`Na ${formatEuro(cijfers.betaald, { centen: false })} aan betalingen`}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <BronnenKaart
              bronnen={bronnen}
              totaal={cijfers.totaal}
              betaaldZonderBron={cijfers.betaaldZonderBron}
            />
            <div className="space-y-6">
              {depots.map((d) => (
                <DepotKaart key={d.id} depot={d} magBewerken={magBewerken} />
              ))}
              {depots.length === 0 && (
                <Card>
                  <div className="p-5 text-sm sm:p-6">
                    <p className="font-medium">Geen bouwdepot</p>
                    <p className="text-muted mt-1 leading-relaxed">
                      Heb je een bouwdepot? Open je hypotheek en vul het bedrag
                      van het bouwdepot in. Dan kun je hier declaraties maken.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>

          {zonderBron.length > 0 && magBewerken && (
            <Card aria-labelledby="zonder-bron-titel">
              <CardHeader
                id="zonder-bron-titel"
                title={`${zonderBron.length} ${zonderBron.length === 1 ? "betaling" : "betalingen"} zonder bron`}
                description="Kies waaruit ze betaald zijn; dan klopt het saldo per bron."
                className="pb-4"
              />
              <div className="border-border border-t p-5 sm:p-6">
                <BetalingenZonderBron
                  betalingen={zonderBron}
                  bronnen={betaalbronnen(bronnen)}
                />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
