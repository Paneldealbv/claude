import { LayoutList, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { CategorieTabel } from "@/components/budget/categorie-tabel";
import { CategorieToevoegenFormulier } from "@/components/budget/formulieren";
import { KpiCard } from "@/components/dashboard/kpi";
import { Card, CardHeader } from "@/components/ui/card";
import { Melding, VerzendKnop } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { standaardIndelingToevoegen } from "@/lib/acties/budget";
import { getActiefProject } from "@/lib/auth";
import { laadProjectResultaat } from "@/lib/data/project";
import { formatEuro, formatEuroVerschil } from "@/lib/format";
import { STANDAARD_CATEGORIEEN } from "@/lib/standaard-indeling";

export const metadata: Metadata = { title: "Budget" };

const heel = { centen: false } as const;

export default async function BudgetPagina() {
  const project = await getActiefProject();
  const { resultaat } = await laadProjectResultaat(project.id);
  const magBewerken = project.rol !== "lezer";
  const t = resultaat.cijfers;

  if (resultaat.categorieen.length === 0) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageHeader
          titel="Budget"
          omschrijving="Verdeel je budget over categorieën. Alle bedragen incl. BTW."
        />
        <Card className="overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_1.1fr]">
            <div className="p-6 sm:p-8">
              <span className="bg-accent-soft text-accent-ink flex size-12 items-center justify-center rounded-2xl">
                <Wallet className="size-6" />
              </span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">
                Begin met je categorieën
              </h2>
              <p className="text-muted mt-2 max-w-md text-sm leading-relaxed">
                Categorieën zijn de posten waarover je je budget verdeelt, zoals
                de aanneemsom, de keuken of de tuin. Begin met onze
                standaardindeling voor een nieuwbouwwoning; je kunt daarna alles
                hernoemen, aanvullen of verwijderen.
              </p>
              {magBewerken ? (
                <div className="mt-6 space-y-6">
                  <form action={standaardIndelingToevoegen}>
                    <VerzendKnop bezigTekst="Bezig…">
                      <LayoutList className="size-4" />
                      Standaardindeling gebruiken
                    </VerzendKnop>
                  </form>
                  <div className="border-border border-t pt-5">
                    <p className="text-muted mb-3 text-sm">
                      Of begin helemaal zelf:
                    </p>
                    <CategorieToevoegenFormulier
                      parentId={null}
                      label="Eerste hoofdcategorie"
                      knop="Toevoegen"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <Melding soort="fout">
                    Je hebt leesrechten. Een eigenaar of bewerker kan de
                    categorieën aanmaken.
                  </Melding>
                </div>
              )}
            </div>
            <div className="bg-surface-2 border-border border-t p-6 sm:p-8 lg:border-t-0 lg:border-l">
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Standaardindeling
              </p>
              <ul className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {STANDAARD_CATEGORIEEN.map((g) => (
                  <li key={g.naam}>
                    <p className="text-sm font-semibold">{g.naam}</p>
                    <ul className="text-muted mt-1 space-y-0.5 text-sm">
                      {g.kinderen.map((k) => (
                        <li key={k}>{k}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const bladeren = resultaat.categorieen.filter((c) => c.isBlad);
  const afgesloten = bladeren.filter((c) => c.afgesloten).length;
  const kostenZonderBudget = resultaat.meldingen.find(
    (m) => m.code === "kosten_zonder_budget",
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        titel="Budget"
        omschrijving="Budget, toezeggingen, kosten en prognose per categorie · alle bedragen incl. BTW"
      />

      <section
        aria-label="Kerncijfers budget"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-4"
      >
        <KpiCard
          label="Totaal budget"
          waarde={t.budget}
          toelichting={`${bladeren.length} categorieën · ${afgesloten} afgesloten`}
        />
        <KpiCard
          label="Prognose eindkosten"
          waarde={t.prognose}
          status={
            t.afwijking !== 0 ? (
              <StatusPill soort={t.afwijking > 0 ? "kritiek" : "positief"}>
                {formatEuroVerschil(t.afwijking, heel)}
              </StatusPill>
            ) : undefined
          }
          toelichting="t.o.v. budget"
        />
        <KpiCard
          label="Vastgelegd"
          waarde={t.vastgelegd}
          meter={
            t.prognose > 0
              ? {
                  aandeel: t.vastgelegd / t.prognose,
                  label: "Vastgelegd als deel van de prognose",
                }
              : undefined
          }
          toelichting={`Nog niet vastgelegd: ${formatEuro(t.nogNietVastgelegd, heel)}`}
        />
        <KpiCard
          label="Betaald"
          waarde={t.betaald}
          toelichting={`Openstaand: ${formatEuro(t.openstaand, heel)}`}
        />
      </section>

      {kostenZonderBudget && (
        <Melding soort="fout">
          Er zijn kosten in{" "}
          {kostenZonderBudget.ids.length === 1
            ? "een categorie"
            : "categorieën"}{" "}
          zonder budget. Geef die categorie een budget of verplaats de kosten.
        </Melding>
      )}

      <Card
        aria-labelledby="categorieen-titel"
        className="overflow-hidden pb-0"
      >
        <CardHeader
          id="categorieen-titel"
          title="Categorieën"
          description="Klik op een categorie om het budget te beheren of haar af te sluiten."
          className="pb-4"
        />
        <div className="border-border border-t">
          <CategorieTabel categorieen={resultaat.categorieen} totaal={t} />
        </div>
      </Card>

      {magBewerken && (
        <Card aria-labelledby="toevoegen-titel">
          <CardHeader
            id="toevoegen-titel"
            title="Hoofdcategorie toevoegen"
            description="Subcategorieën voeg je toe vanuit de hoofdcategorie."
          />
          <div className="px-5 pt-4 pb-5 sm:px-6">
            <CategorieToevoegenFormulier
              parentId={null}
              label="Naam"
              knop="Hoofdcategorie toevoegen"
            />
          </div>
        </Card>
      )}
    </div>
  );
}
