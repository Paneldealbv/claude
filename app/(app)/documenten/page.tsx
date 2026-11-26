import { Plus, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DocumentLijst } from "@/components/documenten/lijst";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { documentOverzicht, type DocumentItem } from "@/lib/data/documenten";
import { formatEuro } from "@/lib/format";

export const metadata: Metadata = { title: "Facturen & bonnen" };

const heel = { centen: false } as const;

const STATUSFILTERS = [
  { waarde: "alle", label: "Alle", past: () => true },
  {
    waarde: "open",
    label: "Nog te betalen",
    past: (d: DocumentItem) => d.status === "geboekt" && d.openstaand !== 0,
  },
  {
    waarde: "te_laat",
    label: "Te laat",
    past: (d: DocumentItem) => d.betaalStatus === "te_laat",
  },
  {
    waarde: "betaald",
    label: "Betaald",
    past: (d: DocumentItem) => d.betaalStatus === "betaald",
  },
  {
    waarde: "niet_geboekt",
    label: "Niet geboekt",
    past: (d: DocumentItem) =>
      d.status === "concept" || d.status === "te_controleren",
  },
  {
    waarde: "vervallen",
    label: "Vervallen",
    past: (d: DocumentItem) => d.status === "vervallen",
  },
] as const;

const SOORTFILTERS = [
  { waarde: "alle", label: "Alle soorten", past: () => true },
  {
    waarde: "facturen",
    label: "Facturen",
    past: (d: DocumentItem) =>
      d.type === "factuur" ||
      d.type === "termijnfactuur" ||
      d.type === "eindfactuur",
  },
  {
    waarde: "bonnen",
    label: "Bonnen",
    past: (d: DocumentItem) => d.type === "bon",
  },
  {
    waarde: "creditnotas",
    label: "Creditnota's",
    past: (d: DocumentItem) => d.type === "creditnota",
  },
] as const;

function Tegel({
  label,
  waarde,
  extra,
  kritiek,
}: {
  label: string;
  waarde: string;
  extra?: string;
  kritiek?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border bg-surface shadow-card rounded-2xl border p-4",
        kritiek && "border-critical/40",
      )}
    >
      <p className="text-muted text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight whitespace-nowrap",
          kritiek && "text-critical",
        )}
      >
        {waarde}
      </p>
      {extra && <p className="text-muted mt-1 text-xs">{extra}</p>}
    </div>
  );
}

export default async function DocumentenPagina({
  searchParams,
}: PageProps<"/documenten">) {
  const zoek = await searchParams;
  const project = await getActiefProject();
  const documenten = await documentOverzicht(project.id);
  const magBewerken = project.rol !== "lezer";

  const status =
    STATUSFILTERS.find((f) => f.waarde === zoek.status) ?? STATUSFILTERS[0];
  const soort =
    SOORTFILTERS.find((f) => f.waarde === zoek.soort) ?? SOORTFILTERS[0];
  const zichtbaar = documenten.filter((d) => status.past(d) && soort.past(d));
  const href = (s: string, t: string) => {
    const delen = [
      s !== "alle" && `status=${s}`,
      t !== "alle" && `soort=${t}`,
    ].filter(Boolean);
    return delen.length ? `/documenten?${delen.join("&")}` : "/documenten";
  };

  const geboekt = documenten.filter((d) => d.status === "geboekt");
  const som = (
    lijst: DocumentItem[],
    veld: "totaal" | "betaald" | "openstaand",
  ) => lijst.reduce((a, d) => a + d[veld], 0);
  const teLaat = documenten.filter((d) => d.betaalStatus === "te_laat");
  const nietGeboekt = documenten.filter(
    (d) => d.status === "concept" || d.status === "te_controleren",
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        titel="Facturen & bonnen"
        omschrijving="Alle facturen, termijnfacturen, eindfacturen, creditnota's en bonnen. Alleen geboekte documenten tellen mee."
        actie={
          magBewerken && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/documenten/nieuw?type=bon"
                className={knopKlassen("secundair")}
              >
                <Receipt className="size-4" />
                Bon
              </Link>
              <Link href="/documenten/nieuw" className={knopKlassen("primair")}>
                <Plus className="size-4" />
                Factuur toevoegen
              </Link>
            </div>
          )
        }
      />

      <section
        aria-label="Samenvatting"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
      >
        <Tegel
          label="Gefactureerd"
          waarde={formatEuro(som(geboekt, "totaal"), heel)}
          extra={`${geboekt.length} geboekt`}
        />
        <Tegel
          label="Betaald"
          waarde={formatEuro(som(geboekt, "betaald"), heel)}
        />
        <Tegel
          label="Nog te betalen"
          waarde={formatEuro(som(geboekt, "openstaand"), heel)}
          extra={
            nietGeboekt.length
              ? `${nietGeboekt.length} nog niet geboekt`
              : undefined
          }
        />
        <Tegel
          label="Te laat"
          waarde={formatEuro(som(teLaat, "openstaand"), heel)}
          extra={`${teLaat.length} ${teLaat.length === 1 ? "document" : "documenten"}`}
          kritiek={teLaat.length > 0}
        />
      </section>

      {documenten.length > 0 && (
        <div className="space-y-2">
          <nav aria-label="Filter op status" className="flex flex-wrap gap-1.5">
            {STATUSFILTERS.map((f) => (
              <Link
                key={f.waarde}
                href={href(f.waarde, soort.waarde)}
                aria-current={status.waarde === f.waarde ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  status.waarde === f.waarde
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "border-border text-muted hover:text-foreground",
                )}
              >
                {f.label}{" "}
                <span className="tabular-nums opacity-70">
                  {documenten.filter((d) => f.past(d) && soort.past(d)).length}
                </span>
              </Link>
            ))}
          </nav>
          <nav aria-label="Filter op soort" className="flex flex-wrap gap-1.5">
            {SOORTFILTERS.map((f) => (
              <Link
                key={f.waarde}
                href={href(status.waarde, f.waarde)}
                aria-current={soort.waarde === f.waarde ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  soort.waarde === f.waarde
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <Card aria-labelledby="lijst-titel" className="overflow-hidden">
        <CardHeader
          id="lijst-titel"
          title={`${zichtbaar.length} ${zichtbaar.length === 1 ? "document" : "documenten"}`}
          className="pb-4"
        />
        <DocumentLijst
          documenten={zichtbaar}
          leeg={
            documenten.length ? (
              "Geen documenten met dit filter."
            ) : (
              <>
                Nog geen facturen of bonnen. Voeg ze toe zodra je ze krijgt; een
                termijnfactuur voer je het makkelijkst in vanaf het
                termijnschema van een contract.
              </>
            )
          }
        />
      </Card>
    </div>
  );
}
