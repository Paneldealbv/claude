import type { Metadata } from "next";
import { BudgetPerCategorie } from "@/components/dashboard/budget-per-categorie";
import { FinancieringKaart } from "@/components/dashboard/financiering";
import { HeroRuimte, KpiCard } from "@/components/dashboard/kpi";
import {
  Activiteit,
  OpenPosten,
  TeControleren,
} from "@/components/dashboard/lijsten";
import { UitgavenPerMaand } from "@/components/dashboard/uitgaven-per-maand";
import { DemoBanner } from "@/components/shell/demo-banner";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import {
  demoActiviteit,
  demoBetalingenPerMaand,
  demoCategorieen,
  demoFinanciering,
  demoOpenPosten,
  demoProject,
  demoTeControleren,
  demoTotalen as t,
} from "@/lib/demo/data";
import { formatDatum, formatEuro, formatEuroVerschil } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

const heel = { centen: false } as const;

export default function DashboardPage() {
  const binnenWeek = demoOpenPosten.filter(
    (p) => p.dagenTotVervallen >= 0 && p.dagenTotVervallen <= 7,
  ).length;
  const afgesloten = demoCategorieen.filter((c) => c.afgesloten).length;

  return (
    <div className="space-y-6 lg:space-y-8">
      <DemoBanner />

      <PageHeader
        titel="Dashboard"
        omschrijving={
          <>
            {demoProject.naam} · bijgewerkt{" "}
            <span className="whitespace-nowrap">
              {formatDatum(demoProject.bijgewerkt)}
            </span>{" "}
            · alle bedragen incl. BTW
          </>
        }
      />

      <section
        aria-label="Kerncijfers"
        className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5"
      >
        <div className="lg:col-span-5 xl:col-span-4">
          <HeroRuimte
            ruimte={t.ruimte}
            financiering={t.financiering}
            prognose={t.prognose}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7 lg:gap-5 xl:col-span-8">
          <KpiCard
            label="Totaal budget"
            waarde={t.budget}
            toelichting={`${demoCategorieen.length} categorieën · ${afgesloten} afgesloten`}
          />
          <KpiCard
            label="Prognose eindkosten"
            waarde={t.prognose}
            status={
              <StatusPill soort={t.afwijking > 0 ? "kritiek" : "positief"}>
                {formatEuroVerschil(t.afwijking, heel)}
              </StatusPill>
            }
            toelichting="t.o.v. budget"
          />
          <KpiCard
            label="Betaald"
            waarde={t.betaald}
            meter={{
              aandeel: t.betaald / t.prognose,
              label: "Betaald als deel van de prognose",
            }}
            toelichting={`${Math.round((t.betaald / t.prognose) * 100)}% van de prognose · ${formatEuro(t.gefactureerd, heel)} gefactureerd`}
          />
          <KpiCard
            label="Openstaand"
            waarde={t.openstaand}
            status={
              binnenWeek > 0 ? (
                <StatusPill soort="waarschuwing">
                  {binnenWeek} vervalt binnen 7 dagen
                </StatusPill>
              ) : undefined
            }
            toelichting={`${demoOpenPosten.length} facturen`}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="min-w-0 space-y-4 lg:col-span-7 lg:space-y-5 xl:col-span-8">
          <BudgetPerCategorie categorieen={demoCategorieen} />
          <OpenPosten posten={demoOpenPosten} />
          <TeControleren items={demoTeControleren} />
        </div>
        <div className="min-w-0 space-y-4 lg:col-span-5 lg:space-y-5 xl:col-span-4">
          <FinancieringKaart data={demoFinanciering} />
          <UitgavenPerMaand data={demoBetalingenPerMaand} />
          <Activiteit items={demoActiviteit} />
        </div>
      </div>
    </div>
  );
}
