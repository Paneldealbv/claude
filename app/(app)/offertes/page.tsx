import { ChevronRight, FileText, Plus, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Afwijking } from "@/components/budget/categorie-tabel";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { getActiefProject } from "@/lib/auth";
import { cn } from "@/lib/cn";
import {
  categorieLabels,
  laadLeveranciers,
  laadOffertes,
  type Offerte,
} from "@/lib/data/offertes";
import { laadProjectResultaat } from "@/lib/data/project";
import { formatDatum, formatEuro } from "@/lib/format";
import { STATUS_OFFERTE } from "@/lib/labels";

export const metadata: Metadata = { title: "Offertes" };

const heel = { centen: false } as const;

const FILTERS = [
  { waarde: "alle", label: "Alle" },
  { waarde: "ontvangen", label: "Ontvangen" },
  { waarde: "geaccepteerd", label: "Geaccepteerd" },
  { waarde: "afgewezen", label: "Afgewezen" },
  { waarde: "verlopen", label: "Verlopen" },
] as const;

type Filter = (typeof FILTERS)[number]["waarde"];

function Tegel({
  label,
  waarde,
  extra,
}: {
  label: string;
  waarde: string;
  extra?: string;
}) {
  return (
    <div className="border-border bg-surface shadow-card rounded-2xl border p-4">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight whitespace-nowrap">
        {waarde}
      </p>
      {extra && <p className="text-muted mt-1 text-xs">{extra}</p>}
    </div>
  );
}

export default async function OffertesPagina({
  searchParams,
}: PageProps<"/offertes">) {
  const zoek = await searchParams;
  const weergave = zoek.weergave === "vergelijk" ? "vergelijk" : "lijst";
  const filter: Filter =
    FILTERS.find((f) => f.waarde === zoek.status)?.waarde ?? "alle";

  const project = await getActiefProject();
  const [offertes, leveranciers, { invoer, resultaat, vandaag }] =
    await Promise.all([
      laadOffertes(project.id),
      laadLeveranciers(project.id),
      laadProjectResultaat(project.id),
    ]);
  const magBewerken = project.rol !== "lezer";
  const leverancierNaam = new Map(leveranciers.map((l) => [l.id, l.naam]));
  const aantal = (status: Filter) =>
    status === "alle"
      ? offertes.length
      : offertes.filter((o) => o.status === status).length;
  const som = (lijst: Offerte[]) => lijst.reduce((a, o) => a + o.totaal, 0);
  const ontvangen = offertes.filter((o) => o.status === "ontvangen");
  const geaccepteerd = offertes.filter((o) => o.status === "geaccepteerd");
  const zichtbaar =
    filter === "alle" ? offertes : offertes.filter((o) => o.status === filter);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        titel="Offertes"
        omschrijving="Offertes tellen nog niet mee in je budget. Accepteer je er een, dan wordt het een contract."
        actie={
          magBewerken && (
            <Link href="/offertes/nieuw" className={knopKlassen("primair")}>
              <Plus className="size-4" />
              Nieuwe offerte
            </Link>
          )
        }
      />

      <section
        aria-label="Samenvatting"
        className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4"
      >
        <Tegel
          label="Nog te beslissen"
          waarde={formatEuro(som(ontvangen), heel)}
          extra={`${ontvangen.length} ${ontvangen.length === 1 ? "offerte" : "offertes"}`}
        />
        <Tegel
          label="Geaccepteerd"
          waarde={formatEuro(som(geaccepteerd), heel)}
          extra={`${geaccepteerd.length} ${geaccepteerd.length === 1 ? "offerte" : "offertes"}`}
        />
        <div className="col-span-2 lg:col-span-1">
          <Tegel
            label="Leveranciers"
            waarde={String(leveranciers.length)}
            extra="met wie je zaken doet"
          />
        </div>
      </section>

      {/* Weergave */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Weergave"
          className="border-border bg-surface inline-flex rounded-xl border p-1"
        >
          {(
            [
              ["lijst", "Lijst", "/offertes"],
              ["vergelijk", "Vergelijken", "/offertes?weergave=vergelijk"],
            ] as const
          ).map(([waarde, label, href]) => (
            <Link
              key={waarde}
              href={href}
              aria-current={weergave === waarde ? "page" : undefined}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                weergave === waarde
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        {weergave === "lijst" && offertes.length > 0 && (
          <nav aria-label="Filter op status" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Link
                key={f.waarde}
                href={
                  f.waarde === "alle"
                    ? "/offertes"
                    : `/offertes?status=${f.waarde}`
                }
                aria-current={filter === f.waarde ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.waarde
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "border-border text-muted hover:text-foreground",
                )}
              >
                {f.label}{" "}
                <span className="tabular-nums opacity-70">
                  {aantal(f.waarde)}
                </span>
              </Link>
            ))}
          </nav>
        )}
      </div>

      {weergave === "lijst" ? (
        <Card aria-labelledby="lijst-titel" className="overflow-hidden">
          <CardHeader
            id="lijst-titel"
            title={
              filter === "alle"
                ? "Alle offertes"
                : `${FILTERS.find((f) => f.waarde === filter)?.label} offertes`
            }
            className="pb-4"
          />
          {zichtbaar.length ? (
            <ul>
              {zichtbaar.map((o) => {
                const verlopen =
                  o.status === "ontvangen" &&
                  o.geldigTot !== null &&
                  o.geldigTot < vandaag;
                return (
                  <li key={o.id} className="border-border border-t">
                    <Link
                      href={`/offertes/${o.id}`}
                      className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3.5 sm:px-6"
                    >
                      <span className="bg-accent-soft text-accent-ink hidden size-9 shrink-0 items-center justify-center rounded-full sm:flex">
                        <FileText className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {o.titel}
                        </p>
                        <p className="text-muted truncate text-xs">
                          {[
                            o.leverancierId
                              ? leverancierNaam.get(o.leverancierId)
                              : null,
                            o.nummer,
                            o.datum && formatDatum(o.datum),
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Geen leverancier"}
                        </p>
                        {verlopen && o.geldigTot && (
                          <p className="text-warning mt-0.5 text-xs font-medium">
                            Was geldig tot {formatDatum(o.geldigTot)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-medium tabular-nums">
                          {formatEuro(o.totaal, heel)}
                        </span>
                        <StatusPill soort={STATUS_OFFERTE[o.status].soort}>
                          {STATUS_OFFERTE[o.status].tekst}
                        </StatusPill>
                      </div>
                      <ChevronRight className="text-subtle size-4 shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="border-border border-t px-5 py-6 sm:px-6">
              <p className="text-muted text-sm">
                {offertes.length
                  ? "Geen offertes met deze status."
                  : "Nog geen offertes. Voeg de offertes toe die je hebt ontvangen; je kunt ze daarna per categorie vergelijken."}
              </p>
              {!offertes.length && magBewerken && (
                <Link
                  href="/offertes/nieuw"
                  className={knopKlassen("secundair", "mt-4")}
                >
                  <Plus className="size-4" />
                  Eerste offerte toevoegen
                </Link>
              )}
            </div>
          )}
        </Card>
      ) : (
        <Vergelijking
          offertes={offertes}
          leverancierNaam={leverancierNaam}
          labels={categorieLabels(invoer.categorieen)}
          budget={
            new Map(resultaat.categorieen.map((c) => [c.id, c.cijfers.budget]))
          }
        />
      )}
    </div>
  );
}

/**
 * Offertes per categorie naast elkaar, goedkoopste eerst. Een offerte met
 * regels in meerdere categorieën staat bij elke categorie met het deel dat
 * daar hoort. Afgewezen en verlopen offertes doen niet mee.
 */
function Vergelijking({
  offertes,
  leverancierNaam,
  labels,
  budget,
}: {
  offertes: Offerte[];
  leverancierNaam: Map<string, string>;
  /** Labels in de volgorde van de budgetpagina. */
  labels: Map<string, string>;
  budget: Map<string, number>;
}) {
  const groepen = new Map<string, { offerte: Offerte; bedrag: number }[]>();
  for (const o of offertes) {
    if (o.status !== "ontvangen" && o.status !== "geaccepteerd") continue;
    const perCategorie = new Map<string, number>();
    for (const r of o.regels) {
      const sleutel = r.categorieId ?? "";
      perCategorie.set(sleutel, (perCategorie.get(sleutel) ?? 0) + r.bedrag);
    }
    for (const [sleutel, bedrag] of perCategorie) {
      const lijst = groepen.get(sleutel) ?? [];
      lijst.push({ offerte: o, bedrag });
      groepen.set(sleutel, lijst);
    }
  }
  const plek = new Map([...labels.keys()].map((id, i) => [id, i]));
  const lijst = [...groepen.entries()]
    .map(([sleutel, rijen]) => ({
      sleutel,
      label: sleutel
        ? (labels.get(sleutel) ?? "Onbekende categorie")
        : "Zonder categorie",
      budget: sleutel ? (budget.get(sleutel) ?? 0) : null,
      rijen: rijen.sort((a, b) => a.bedrag - b.bedrag),
    }))
    .sort((a, b) => {
      if (!a.sleutel) return 1;
      if (!b.sleutel) return -1;
      return (
        (plek.get(a.sleutel) ?? 0) - (plek.get(b.sleutel) ?? 0) ||
        a.label.localeCompare(b.label, "nl")
      );
    });

  if (!lijst.length) {
    return (
      <Card className="px-5 py-6 sm:px-6">
        <p className="text-muted text-sm">
          Er zijn nog geen ontvangen offertes om te vergelijken.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted text-sm">
        Per categorie, goedkoopste eerst. Afgewezen en verlopen offertes doen
        niet mee. Het verschil is ten opzichte van het budget van de categorie.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        {lijst.map((g) => (
          <Card
            key={g.sleutel || "zonder"}
            aria-label={g.label}
            className="overflow-hidden"
          >
            <CardHeader
              title={g.label}
              description={
                g.budget !== null
                  ? `Budget ${formatEuro(g.budget, heel)}`
                  : "Geef deze regels een categorie om ze mee te laten tellen."
              }
              className="pb-4"
            />
            <ul>
              {g.rijen.map(({ offerte: o, bedrag }, i) => (
                <li key={o.id} className="border-border border-t">
                  <Link
                    href={`/offertes/${o.id}`}
                    className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">
                          {(o.leverancierId &&
                            leverancierNaam.get(o.leverancierId)) ||
                            o.titel}
                        </span>
                        {i === 0 && g.rijen.length > 1 && (
                          <StatusPill soort="positief" icon={Trophy}>
                            Laagste
                          </StatusPill>
                        )}
                        {o.status === "geaccepteerd" && (
                          <StatusPill soort="info">Geaccepteerd</StatusPill>
                        )}
                      </p>
                      <p className="text-muted truncate text-xs">{o.titel}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatEuro(bedrag, heel)}
                      </span>
                      {g.budget !== null && g.budget > 0 && (
                        <Afwijking bedrag={bedrag - g.budget} />
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
