import { FileSpreadsheet, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AfdrukKnop } from "@/components/rapportages/afdruk-knop";
import { RapportTabel } from "@/components/rapportages/tabel";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { PageHeader } from "@/components/ui/page-header";
import { getActiefProject } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { vandaagIso } from "@/lib/datum";
import { formatDatum } from "@/lib/format";
import { laadRapporten, RAPPORTEN } from "@/lib/rapportages";

export const metadata: Metadata = { title: "Rapportages" };

export default async function RapportagesPagina({
  searchParams,
}: PageProps<"/rapportages">) {
  const project = await getActiefProject();
  const { rapport: gevraagd, lege } = await searchParams;
  const sleutel =
    RAPPORTEN.find((r) => r.sleutel === gevraagd)?.sleutel ?? "categorie";
  const volledig = (await laadRapporten(project.id))[sleutel];
  // Regels zonder enig bedrag standaard verbergen (de export bevat alles).
  const isLeeg = (r: (typeof volledig.rijen)[number]) =>
    !r.totaal &&
    r.cellen.every(
      (w, i) =>
        (volledig.kolommen[i].soort !== "bedrag" &&
          volledig.kolommen[i].soort !== "getal") ||
        !w,
    );
  const aantalLeeg = volledig.rijen.filter(isLeeg).length;
  const toonLeeg = lege === "1";
  const rapport = toonLeeg
    ? volledig
    : { ...volledig, rijen: volledig.rijen.filter((r) => !isLeeg(r)) };
  const basisHref =
    sleutel === "categorie"
      ? "/rapportages"
      : `/rapportages?rapport=${sleutel}`;
  const leegHref = toonLeeg
    ? basisHref
    : `${basisHref}${basisHref.includes("?") ? "&" : "?"}lege=1`;
  const exportHref = (formaat: "csv" | "xlsx") =>
    `/rapportages/export?rapport=${sleutel}&formaat=${formaat}`;

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="print:hidden">
        <PageHeader
          titel="Rapportages"
          omschrijving="Overzichten van je project, bedragen incl. BTW. Exporteer naar Excel of CSV, of druk af als PDF."
          actie={
            <a
              href="/rapportages/export?rapport=alles&formaat=xlsx"
              className={knopKlassen("secundair")}
            >
              <FileSpreadsheet className="size-4" />
              Alles naar Excel
            </a>
          }
        />
      </div>

      <nav
        aria-label="Rapporten"
        className="flex flex-wrap gap-1.5 print:hidden"
      >
        {RAPPORTEN.map((r) => (
          <Link
            key={r.sleutel}
            href={
              r.sleutel === "categorie"
                ? "/rapportages"
                : `/rapportages?rapport=${r.sleutel}`
            }
            aria-current={r.sleutel === sleutel ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              r.sleutel === sleutel
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-border text-muted hover:text-foreground",
            )}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      {/* Alleen op papier / in de PDF */}
      <p className="text-muted hidden text-xs print:block">
        {project.naam} · {formatDatum(vandaagIso())} · bedragen incl. BTW
      </p>

      <Card aria-labelledby="rapport-titel" className="overflow-hidden">
        <CardHeader
          id="rapport-titel"
          title={rapport.titel}
          description={rapport.omschrijving}
          action={
            <div className="flex flex-wrap gap-2 print:hidden">
              <a
                href={exportHref("csv")}
                className={knopKlassen("secundair", "px-3 py-2")}
              >
                <FileText className="size-4" />
                CSV
              </a>
              <a
                href={exportHref("xlsx")}
                className={knopKlassen("secundair", "px-3 py-2")}
              >
                <FileSpreadsheet className="size-4" />
                Excel
              </a>
              <AfdrukKnop />
            </div>
          }
          className="pb-4"
        />
        <RapportTabel rapport={rapport} />
        {aantalLeeg > 0 && (
          <p className="text-muted border-border border-t px-5 py-3 text-xs sm:px-6 print:hidden">
            {toonLeeg
              ? "Ook regels zonder bedragen worden getoond. "
              : `${aantalLeeg} ${aantalLeeg === 1 ? "regel" : "regels"} zonder bedragen verborgen. `}
            <Link
              href={leegHref}
              className="text-accent-ink font-medium hover:underline"
            >
              {toonLeeg ? "Verberg lege regels" : "Toon alles"}
            </Link>
          </p>
        )}
      </Card>
      <p className="text-muted text-xs">
        Alleen geboekte facturen en bonnen tellen mee. Een open categorie telt
        minimaal haar budget in de prognose.
      </p>
    </div>
  );
}
