import { ChevronRight, FileText, Handshake, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { getActiefProject } from "@/lib/auth";
import { laadLeveranciers } from "@/lib/data/offertes";
import { laadProjectResultaat } from "@/lib/data/project";
import { formatEuro } from "@/lib/format";
import { STATUS_CONTRACT } from "@/lib/labels";

export const metadata: Metadata = { title: "Contracten" };

const heel = { centen: false } as const;
const VOLGORDE = { actief: 0, afgerond: 1, geannuleerd: 2 } as const;

function Tegel({
  label,
  waarde,
  extra,
}: {
  label: string;
  waarde: number;
  extra?: string;
}) {
  return (
    <div className="border-border bg-surface shadow-card rounded-2xl border p-4">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight whitespace-nowrap">
        {formatEuro(waarde, heel)}
      </p>
      {extra && <p className="text-muted mt-1 text-xs">{extra}</p>}
    </div>
  );
}

export default async function ContractenPagina() {
  const project = await getActiefProject();
  const [leveranciers, { invoer, resultaat }] = await Promise.all([
    laadLeveranciers(project.id),
    laadProjectResultaat(project.id),
  ]);
  const magBewerken = project.rol !== "lezer";
  const leverancierNaam = new Map(leveranciers.map((l) => [l.id, l.naam]));
  const leverancierVan = new Map(
    invoer.contracten.map((c) => [c.id, c.leverancierId]),
  );
  const contracten = [...resultaat.contracten].sort(
    (a, b) =>
      VOLGORDE[a.status] - VOLGORDE[b.status] ||
      a.titel.localeCompare(b.titel, "nl"),
  );
  const som = (veld: "gecontracteerd" | "gefactureerd" | "nogTeFactureren") =>
    contracten.reduce((a, c) => a + c[veld], 0);
  const voorgesteld = invoer.wijzigingen
    .filter((w) => w.status === "voorgesteld")
    .reduce((a, w) => a + w.bedrag, 0);
  const aantalVoorgesteld = invoer.wijzigingen.filter(
    (w) => w.status === "voorgesteld",
  ).length;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        titel="Contracten"
        omschrijving="Wat je hebt afgesproken. Contracten tellen mee in de prognose van je budget."
        actie={
          magBewerken && (
            <div className="flex flex-wrap gap-2">
              <Link href="/offertes" className={knopKlassen("secundair")}>
                <FileText className="size-4" />
                Offerte accepteren
              </Link>
              <Link href="/contracten/nieuw" className={knopKlassen("primair")}>
                <Plus className="size-4" />
                Nieuw contract
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
          label="Gecontracteerd"
          waarde={som("gecontracteerd")}
          extra={`${contracten.length} ${contracten.length === 1 ? "contract" : "contracten"}`}
        />
        <Tegel label="Gefactureerd" waarde={som("gefactureerd")} />
        <Tegel label="Nog te factureren" waarde={som("nogTeFactureren")} />
        <Tegel
          label="Meerwerk in afwachting"
          waarde={voorgesteld}
          extra={
            aantalVoorgesteld
              ? `${aantalVoorgesteld} ${aantalVoorgesteld === 1 ? "voorstel" : "voorstellen"}, telt nog niet mee`
              : "geen open voorstellen"
          }
        />
      </section>

      <Card aria-labelledby="lijst-titel" className="overflow-hidden">
        <CardHeader id="lijst-titel" title="Alle contracten" className="pb-4" />
        {contracten.length ? (
          <ul>
            {contracten.map((c) => {
              const leverancierId = leverancierVan.get(c.id);
              const voortgang =
                c.gecontracteerd > 0
                  ? Math.min(
                      100,
                      Math.round((c.gefactureerd / c.gecontracteerd) * 100),
                    )
                  : 0;
              return (
                <li key={c.id} className="border-border border-t">
                  <Link
                    href={`/contracten/${c.id}`}
                    className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3.5 sm:px-6"
                  >
                    <span className="bg-accent-soft text-accent-ink hidden size-9 shrink-0 items-center justify-center rounded-full sm:flex">
                      <Handshake className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.titel}</p>
                      <p className="text-muted truncate text-xs">
                        {(leverancierId &&
                          leverancierNaam.get(leverancierId)) ||
                          "Geen leverancier"}
                      </p>
                      {c.status !== "geannuleerd" && c.gecontracteerd > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div
                            className="bg-surface-2 h-1.5 w-full max-w-48 overflow-hidden rounded-full"
                            role="progressbar"
                            aria-valuenow={voortgang}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Gefactureerd"
                          >
                            <div
                              className="bg-accent h-full rounded-full"
                              style={{ width: `${voortgang}%` }}
                            />
                          </div>
                          <span className="text-muted text-xs whitespace-nowrap tabular-nums">
                            {voortgang}% gefactureerd
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums">
                        {formatEuro(c.prognose, heel)}
                      </span>
                      <StatusPill soort={STATUS_CONTRACT[c.status].soort}>
                        {STATUS_CONTRACT[c.status].tekst}
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
              Nog geen contracten. Accepteer een offerte, of leg een afspraak
              zonder offerte vast als nieuw contract.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
