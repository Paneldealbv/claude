import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BronFormulier,
  BronVerwijderen,
} from "@/components/financiering/formulieren";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tegel } from "@/components/ui/tegel";
import { getActiefProject } from "@/lib/auth";
import { laadBron } from "@/lib/data/financiering";
import { formatEuro } from "@/lib/format";
import { BRON_TYPE, type HoofdbronSoort } from "@/lib/labels";

export const metadata: Metadata = { title: "Bron" };

export default async function BronPagina({
  params,
}: PageProps<"/financiering/[id]">) {
  const { id } = await params;
  const project = await getActiefProject();
  const bron = await laadBron(project.id, id);
  if (!bron) notFound();
  const magBewerken = project.rol !== "lezer";
  const depot = bron.delen.find((d) => d.type === "bouwdepot") ?? null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link href="/financiering" className="hover:text-foreground">
          Financiering
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{bron.naam}</span>
      </nav>
      <PageHeader
        titel={bron.naam}
        omschrijving={
          bron.delen.length
            ? `${BRON_TYPE[bron.type].tekst}, verdeeld in ${bron.delen.map((d) => d.naam.toLowerCase()).join(" en ")}.`
            : BRON_TYPE[bron.type].tekst
        }
      />
      <section
        aria-label="Kerncijfers"
        className="grid grid-cols-2 gap-3 lg:grid-cols-3"
      >
        <Tegel label="Bedrag" waarde={formatEuro(bron.bedrag)} />
        <Tegel label="Betaald" waarde={formatEuro(bron.betaald)} />
        <Tegel
          label="Saldo"
          waarde={formatEuro(bron.saldo)}
          kritiek={bron.saldo < 0}
        />
      </section>

      <Card aria-labelledby="gegevens-titel" className="max-w-3xl">
        <CardHeader id="gegevens-titel" title="Gegevens" className="pb-4" />
        <div className="border-border border-t p-5 sm:p-6">
          {magBewerken ? (
            <BronFormulier
              bron={{
                id: bron.id,
                type: bron.type as HoofdbronSoort,
                naam: bron.naam,
                verstrekker: bron.verstrekker,
                bedrag: bron.bedrag,
                renteBp: bron.renteBp,
                start: bron.start,
                eind: bron.eind,
                notities: bron.notities,
                bouwdepot: depot?.bedrag ?? null,
                depotEind: depot?.eind ?? null,
              }}
            />
          ) : (
            <p className="text-muted text-sm">
              Je hebt alleen leesrechten in dit project.
            </p>
          )}
        </div>
      </Card>

      {magBewerken && (
        <Card aria-labelledby="verwijderen-titel" className="max-w-3xl">
          <CardHeader
            id="verwijderen-titel"
            title="Bron verwijderen"
            className="pb-4"
          />
          <div className="border-border border-t p-5 sm:p-6">
            <BronVerwijderen
              id={bron.id}
              heeftBetalingen={
                bron.betaald !== 0 || bron.delen.some((d) => d.betaald !== 0)
              }
            />
          </div>
        </Card>
      )}
    </div>
  );
}
