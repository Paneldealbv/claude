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
import { demoDashboard } from "@/lib/demo/dashboard";
import { demoActiviteit, demoTeControleren } from "@/lib/demo/data";
import { getActiefProject } from "@/lib/auth";
import { formatEuro, formatEuroVerschil } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

const heel = { centen: false } as const;

export default async function DashboardPage() {
  const project = await getActiefProject();
  // Demo-project, doorgerekend met dezelfde rekenlogica als de echte gegevens.
  const { resultaat, budgetRijen, maanden, openPosten } = demoDashboard();
  const t = resultaat.cijfers;
  const f = resultaat.financiering;
  const binnenWeek = openPosten.filter(
    (p) =>
      p.dagenTotVervallen !== null &&
      p.dagenTotVervallen >= 0 &&
      p.dagenTotVervallen <= 7,
  ).length;
  const afgesloten = budgetRijen.filter((c) => c.afgesloten).length;
  const betaaldAandeel = t.prognose > 0 ? t.betaald / t.prognose : 0;

  return (
    <div className="space-y-6 lg:space-y-8">
      <DemoBanner />

      <PageHeader
        titel="Dashboard"
        omschrijving={<>{project.naam} · alle bedragen incl. BTW</>}
      />

      <section
        aria-label="Kerncijfers"
        className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5"
      >
        <div className="lg:col-span-5 xl:col-span-4">
          <HeroRuimte
            ruimte={f.ruimte}
            financiering={f.totaalBeschikbaar}
            prognose={t.prognose}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7 lg:gap-5 xl:col-span-8">
          <KpiCard
            label="Totaal budget"
            waarde={t.budget}
            toelichting={`${budgetRijen.length} categorieën · ${afgesloten} afgesloten`}
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
              aandeel: betaaldAandeel,
              label: "Betaald als deel van de prognose",
            }}
            toelichting={`${Math.round(betaaldAandeel * 100)}% van de prognose · ${formatEuro(t.gefactureerd, heel)} gefactureerd`}
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
            toelichting={`${openPosten.length} ${openPosten.length === 1 ? "factuur" : "facturen"}`}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="min-w-0 space-y-4 lg:col-span-7 lg:space-y-5 xl:col-span-8">
          <BudgetPerCategorie categorieen={budgetRijen} />
          <OpenPosten posten={openPosten} />
          <TeControleren items={demoTeControleren} />
        </div>
        <div className="min-w-0 space-y-4 lg:col-span-5 lg:space-y-5 xl:col-span-4">
          <FinancieringKaart data={f} />
          <UitgavenPerMaand data={maanden} />
          <Activiteit items={demoActiviteit} />
        </div>
      </div>
    </div>
  );
}
