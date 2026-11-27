import { ArrowRight, CircleCheck, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BudgetPerCategorie } from "@/components/dashboard/budget-per-categorie";
import { FinancieringKaart } from "@/components/dashboard/financiering";
import { HeroPrognose, HeroRuimte, KpiCard } from "@/components/dashboard/kpi";
import {
  Activiteit,
  OpenPosten,
  TeControleren,
} from "@/components/dashboard/lijsten";
import { UitgavenPerMaand } from "@/components/dashboard/uitgaven-per-maand";
import { DemoBanner } from "@/components/shell/demo-banner";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { getActiefProject } from "@/lib/auth";
import type {
  ActiviteitItem,
  BudgetRij,
  ControleItem,
  MaandPunt,
  OpenPost,
} from "@/lib/dashboard";
import { laadDashboard } from "@/lib/data/dashboard";
import { demoActiviteit, demoTeControleren } from "@/lib/demo/data";
import { demoDashboard } from "@/lib/demo/dashboard";
import type { ProjectResultaat } from "@/lib/finance";
import { formatEuro, formatEuroVerschil } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

const heel = { centen: false } as const;

type Stap = { tekst: string; href: string; klaar: boolean };

/** Eerste stappen voor een nieuw project, met wat al gedaan is. */
function AanDeSlag({ stappen }: { stappen: Stap[] }) {
  const klaar = stappen.filter((s) => s.klaar).length;
  return (
    <Card aria-labelledby="start-titel">
      <CardHeader
        id="start-titel"
        title="Aan de slag"
        description={`${klaar} van ${stappen.length} stappen gedaan. Het dashboard vult zich vanzelf naarmate je meer invoert.`}
        action={
          <Link
            href="/dashboard?demo=1"
            className="text-accent-ink hover:bg-accent-soft -mr-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium"
          >
            Voorbeeld bekijken
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <ol className="grid gap-2 px-5 pt-4 pb-5 sm:grid-cols-2 sm:px-6">
        {stappen.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="border-border hover:bg-surface-2 flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm"
            >
              {s.klaar ? (
                <CircleCheck
                  className="text-positive size-5 shrink-0"
                  aria-label="Gedaan"
                />
              ) : (
                <Circle
                  className="text-subtle size-5 shrink-0"
                  aria-label="Nog te doen"
                />
              )}
              <span className={s.klaar ? "text-muted" : "font-medium"}>
                {s.tekst}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function DashboardWeergave({
  demo,
  projectNaam,
  resultaat,
  budgetRijen,
  maanden,
  openPosten,
  teControleren,
  activiteit,
  aantalCategorieen,
  stappen,
}: {
  demo: boolean;
  projectNaam: string;
  resultaat: ProjectResultaat;
  budgetRijen: BudgetRij[];
  maanden: MaandPunt[];
  openPosten: OpenPost[];
  teControleren: ControleItem[];
  activiteit: ActiviteitItem[];
  aantalCategorieen: number;
  stappen?: Stap[];
}) {
  const t = resultaat.cijfers;
  const f = resultaat.financiering;
  const metFinanciering = f.totaalBeschikbaar > 0;
  const binnenWeek = openPosten.filter(
    (p) =>
      p.dagenTotVervallen !== null &&
      p.dagenTotVervallen >= 0 &&
      p.dagenTotVervallen <= 7,
  ).length;
  const teLaat = openPosten.filter(
    (p) => p.dagenTotVervallen !== null && p.dagenTotVervallen < 0,
  ).length;
  const afgesloten = budgetRijen.filter((c) => c.afgesloten).length;
  const betaaldAandeel = t.prognose > 0 ? t.betaald / t.prognose : 0;

  return (
    <div className="space-y-6 lg:space-y-8">
      {demo && <DemoBanner />}

      <PageHeader
        titel="Dashboard"
        omschrijving={
          <>
            {demo ? "Voorbeeldproject" : projectNaam} · alle bedragen incl. BTW
          </>
        }
        actie={
          !demo && (
            <Link href="/rapportages" className={knopKlassen("secundair")}>
              Rapportages
              <ArrowRight className="size-4" />
            </Link>
          )
        }
      />

      {stappen && stappen.some((s) => !s.klaar) && (
        <AanDeSlag stappen={stappen} />
      )}

      <section
        aria-label="Kerncijfers"
        className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5"
      >
        <div className="lg:col-span-5 xl:col-span-4">
          {metFinanciering ? (
            <HeroRuimte
              ruimte={f.ruimte}
              financiering={f.totaalBeschikbaar}
              prognose={t.prognose}
            />
          ) : (
            <HeroPrognose prognose={t.prognose} budget={t.budget} />
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7 lg:gap-5 xl:col-span-8">
          <KpiCard
            label="Totaal budget"
            waarde={t.budget}
            toelichting={`${aantalCategorieen} categorieën · ${afgesloten} afgesloten`}
          />
          {metFinanciering ? (
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
          ) : (
            <KpiCard
              label="Vastgelegd"
              waarde={t.vastgelegd}
              meter={{
                aandeel: t.prognose > 0 ? t.vastgelegd / t.prognose : 0,
                label: "Vastgelegd als deel van de prognose",
              }}
              toelichting="in contracten en geboekte kosten"
            />
          )}
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
              teLaat > 0 ? (
                <StatusPill soort="kritiek">{teLaat} te laat</StatusPill>
              ) : binnenWeek > 0 ? (
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
          <TeControleren
            items={teControleren}
            omschrijving={
              demo
                ? "AI-voorstellen · tellen pas mee na bevestiging"
                : "AI-voorstellen en concepten · tellen pas mee na boeken"
            }
          />
        </div>
        <div className="min-w-0 space-y-4 lg:col-span-5 lg:space-y-5 xl:col-span-4">
          <FinancieringKaart data={f} />
          <UitgavenPerMaand data={maanden} />
          <Activiteit items={activiteit} />
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const project = await getActiefProject();
  const { demo } = await searchParams;

  if (demo === "1") {
    // Voorbeeldproject, doorgerekend met dezelfde rekenlogica.
    const d = demoDashboard();
    return (
      <DashboardWeergave
        demo
        projectNaam={project.naam}
        resultaat={d.resultaat}
        budgetRijen={d.budgetRijen}
        maanden={d.maanden}
        openPosten={d.openPosten}
        teControleren={demoTeControleren}
        activiteit={demoActiviteit}
        aantalCategorieen={d.budgetRijen.length}
      />
    );
  }

  const d = await laadDashboard(project.id);
  return (
    <DashboardWeergave
      demo={false}
      projectNaam={project.naam}
      resultaat={d.resultaat}
      budgetRijen={d.budgetRijen}
      maanden={d.maanden}
      openPosten={d.openPosten}
      teControleren={d.teControleren}
      activiteit={d.activiteit}
      aantalCategorieen={d.aantalCategorieen}
      stappen={d.stappen}
    />
  );
}
