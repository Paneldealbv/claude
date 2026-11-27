import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DeclaratieActies,
  DeclaratieFormulier,
} from "@/components/financiering/declaraties";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { getActiefProject } from "@/lib/auth";
import { vandaagIso } from "@/lib/datum";
import { declarabeleDocumenten, laadDeclaratie } from "@/lib/data/financiering";
import { formatDatum, formatEuro } from "@/lib/format";
import { STATUS_DECLARATIE } from "@/lib/labels";

export const metadata: Metadata = { title: "Declaratie" };

export default async function DeclaratiePagina({
  params,
}: PageProps<"/financiering/declaraties/[id]">) {
  const { id } = await params;
  const project = await getActiefProject();
  const gevonden = await laadDeclaratie(project.id, id);
  if (!gevonden) notFound();
  const { declaratie: c, depot } = gevonden;
  const magBewerken = project.rol !== "lezer";
  const bewerkbaar =
    magBewerken && (c.status === "concept" || c.status === "ingediend");
  const documenten = bewerkbaar
    ? await declarabeleDocumenten(project.id, c.id)
    : [];
  const s = STATUS_DECLARATIE[c.status];
  const titel = `Declaratie ${c.nummer ?? "zonder nummer"}`;
  const vandaag = vandaagIso();

  const stappen = [
    { label: "Ingediend", datum: c.ingediendOp },
    c.status === "afgewezen"
      ? { label: "Afgewezen", datum: null }
      : { label: "Uitbetaald", datum: c.uitbetaaldOp },
  ];

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
        <span className="text-foreground">{titel}</span>
      </nav>
      <PageHeader
        titel={titel}
        omschrijving={
          depot
            ? `Bouwdepot van ${depot.hypotheek} · ${formatEuro(c.bedrag)}`
            : formatEuro(c.bedrag)
        }
        actie={<StatusPill soort={s.soort}>{s.tekst}</StatusPill>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <Card aria-labelledby="facturen-titel" className="overflow-hidden">
          <CardHeader
            id="facturen-titel"
            title="Facturen in deze declaratie"
            className="pb-4"
          />
          <ul>
            {c.regels.map((r) => (
              <li key={r.id} className="border-border border-t">
                <Link
                  href={`/documenten/${r.documentId}`}
                  className="hover:bg-surface-2 flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6"
                >
                  <span className="min-w-0 truncate">{r.titel}</span>
                  <span className="font-medium tabular-nums">
                    {formatEuro(r.bedrag)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="border-border bg-surface-2/60 flex justify-between border-t px-5 py-3 text-sm font-semibold sm:px-6">
            <span>Totaal</span>
            <span className="tabular-nums">{formatEuro(c.bedrag)}</span>
          </p>
          {c.notities && (
            <p className="text-muted border-border border-t px-5 py-3 text-sm sm:px-6">
              {c.notities}
            </p>
          )}
        </Card>

        <Card aria-labelledby="status-titel">
          <CardHeader id="status-titel" title="Status" className="pb-4" />
          <div className="border-border space-y-5 border-t p-5 sm:p-6">
            <ol className="space-y-2 text-sm">
              {stappen.map((st) => (
                <li key={st.label} className="flex justify-between gap-3">
                  <span className={st.datum ? "" : "text-muted"}>
                    {st.label}
                  </span>
                  <span className="text-muted tabular-nums">
                    {st.datum ? formatDatum(st.datum) : "—"}
                  </span>
                </li>
              ))}
            </ol>
            {magBewerken ? (
              <DeclaratieActies id={c.id} status={c.status} vandaag={vandaag} />
            ) : (
              <p className="text-muted text-sm">
                Je hebt alleen leesrechten in dit project.
              </p>
            )}
          </div>
        </Card>
      </div>

      {bewerkbaar && depot && (
        <Card aria-labelledby="bewerken-titel" className="max-w-3xl">
          <CardHeader
            id="bewerken-titel"
            title="Declaratie aanpassen"
            description="Facturen of bedragen wijzigen kan tot de uitbetaling."
            className="pb-4"
          />
          <div className="border-border border-t p-5 sm:p-6">
            <DeclaratieFormulier
              declaratie={{
                id: c.id,
                nummer: c.nummer,
                notities: c.notities,
                ingediendOp: c.ingediendOp,
                regels: c.regels.map((r) => ({
                  documentId: r.documentId,
                  bedrag: r.bedrag,
                })),
              }}
              depot={{ id: depot.id, vrij: depot.stand.vrij }}
              documenten={documenten}
              vandaag={vandaag}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
