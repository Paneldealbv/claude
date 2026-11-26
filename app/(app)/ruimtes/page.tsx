import { DoorOpen, LayoutList } from "lucide-react";
import type { Metadata } from "next";
import { RuimteLijst, RuimteToevoegen } from "@/components/ruimtes/ruimtes";
import { Card, CardHeader } from "@/components/ui/card";
import { Melding, VerzendKnop } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { standaardRuimtesToevoegen } from "@/lib/acties/ruimtes";
import { getActiefProject } from "@/lib/auth";
import { laadProjectResultaat } from "@/lib/data/project";
import { formatEuro } from "@/lib/format";
import { STANDAARD_RUIMTES } from "@/lib/standaard-indeling";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ruimtes" };

const heel = { centen: false } as const;

export default async function RuimtesPagina() {
  const project = await getActiefProject();
  const { resultaat } = await laadProjectResultaat(project.id);
  const magBewerken = project.rol !== "lezer";

  const supabase = await createClient();
  const { data: rijen } = await supabase
    .from("rooms")
    .select("id, name, floor")
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  const cijfersPerRuimte = new Map(resultaat.ruimtes.map((r) => [r.id, r]));
  const ruimtes = (rijen ?? []).map((r) => ({
    id: r.id,
    naam: r.name,
    verdieping: r.floor,
    vastgelegd: cijfersPerRuimte.get(r.id)?.vastgelegd ?? 0,
  }));
  const heeftKosten = resultaat.ruimtes.some(
    (r) => r.gecontracteerd || r.gefactureerd || r.vastgelegd,
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        titel="Ruimtes"
        omschrijving="De ruimtes van je woning, los van de financiële categorieën. Kosten kun je over één of meer ruimtes verdelen."
      />

      {ruimtes.length === 0 ? (
        <Card className="overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_1.1fr]">
            <div className="p-6 sm:p-8">
              <span className="bg-accent-soft text-accent-ink flex size-12 items-center justify-center rounded-2xl">
                <DoorOpen className="size-6" />
              </span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">
                Voeg de ruimtes van je woning toe
              </h2>
              <p className="text-muted mt-2 max-w-md text-sm leading-relaxed">
                Met ruimtes zie je straks wat bijvoorbeeld de keuken of de
                badkamer in totaal kost, ook als de kosten uit verschillende
                categorieën komen.
              </p>
              {magBewerken ? (
                <div className="mt-6 space-y-6">
                  <form action={standaardRuimtesToevoegen}>
                    <VerzendKnop bezigTekst="Bezig…">
                      <LayoutList className="size-4" />
                      Standaardruimtes gebruiken
                    </VerzendKnop>
                  </form>
                  <div className="border-border border-t pt-5">
                    <p className="text-muted mb-3 text-sm">
                      Of voeg zelf een ruimte toe:
                    </p>
                    <RuimteToevoegen />
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <Melding soort="fout">
                    Je hebt leesrechten. Een eigenaar of bewerker kan ruimtes
                    toevoegen.
                  </Melding>
                </div>
              )}
            </div>
            <div className="bg-surface-2 border-border border-t p-6 sm:p-8 lg:border-t-0 lg:border-l">
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Standaardruimtes
              </p>
              <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                {STANDAARD_RUIMTES.map((r) => (
                  <li key={r.naam}>
                    {r.naam}{" "}
                    <span className="text-subtle">· {r.verdieping}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <div className="min-w-0 space-y-4 lg:col-span-7 lg:space-y-5">
            <Card aria-labelledby="ruimtes-titel" className="overflow-hidden">
              <CardHeader
                id="ruimtes-titel"
                title={`${ruimtes.length} ${ruimtes.length === 1 ? "ruimte" : "ruimtes"}`}
                className="pb-4"
              />
              <RuimteLijst ruimtes={ruimtes} magBewerken={magBewerken} />
              {magBewerken && (
                <div className="border-border border-t px-5 py-4 sm:px-6">
                  <RuimteToevoegen />
                </div>
              )}
            </Card>
          </div>

          <div className="min-w-0 lg:col-span-5">
            <Card aria-labelledby="kosten-titel" className="overflow-hidden">
              <CardHeader
                id="kosten-titel"
                title="Kosten per ruimte"
                description="Incl. BTW. Wat niet aan een ruimte is gekoppeld, staat onder 'Niet toegewezen'."
                className="pb-4"
              />
              {heeftKosten ? (
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-border text-muted border-y text-left text-xs">
                      <th scope="col" className="px-5 py-2 font-medium sm:px-6">
                        Ruimte
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right font-medium"
                      >
                        Gefactureerd
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-2 text-right font-medium sm:px-6"
                      >
                        Vastgelegd
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultaat.ruimtes
                      .filter(
                        (r) => r.id !== null || r.vastgelegd || r.gefactureerd,
                      )
                      .map((r) => (
                        <tr
                          key={r.id ?? "niet-toegewezen"}
                          className="border-border border-b last:border-0"
                        >
                          <th
                            scope="row"
                            className="px-5 py-2.5 text-left font-normal sm:px-6"
                          >
                            {r.naam}
                          </th>
                          <td className="px-3 py-2.5 text-right">
                            {formatEuro(r.gefactureerd, heel)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-medium sm:px-6">
                            {formatEuro(r.vastgelegd, heel)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted border-border border-t px-5 py-4 text-sm leading-relaxed sm:px-6">
                  Zodra je contracten, facturen en bonnen aan ruimtes koppelt,
                  zie je hier wat elke ruimte kost.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
