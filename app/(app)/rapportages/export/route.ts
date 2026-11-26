import type { NextRequest } from "next/server";
import { getActiefProject } from "@/lib/auth";
import { vandaagIso } from "@/lib/datum";
import { naarCsv, naarExcel } from "@/lib/export";
import { laadRapporten, RAPPORTEN } from "@/lib/rapportages";

const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function bestand(inhoud: BodyInit, naam: string, type: string) {
  return new Response(inhoud, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${naam}"`,
      // Financiële gegevens: nooit door tussenliggende caches bewaren.
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * Export van een rapport als CSV of Excel, of alles als één Excel-werkmap.
 * Alleen voor ingelogde leden van het actieve project (via RLS).
 */
export async function GET(request: NextRequest) {
  const project = await getActiefProject();
  const zoek = request.nextUrl.searchParams;
  const gevraagd = zoek.get("rapport") ?? "categorie";
  const formaat = zoek.get("formaat") === "xlsx" ? "xlsx" : "csv";
  const datum = vandaagIso();
  const rapporten = await laadRapporten(project.id);

  if (gevraagd === "alles") {
    if (formaat !== "xlsx") {
      return new Response("Alles exporteren kan alleen als Excel.", {
        status: 400,
      });
    }
    const werkmap = await naarExcel(
      RAPPORTEN.map((r) => rapporten[r.sleutel]),
      { project: project.naam, datum },
    );
    return bestand(werkmap, `nieuwbouw-alles-${datum}.xlsx`, XLSX);
  }

  const sleutel = RAPPORTEN.find((r) => r.sleutel === gevraagd)?.sleutel;
  if (!sleutel) return new Response("Onbekend rapport.", { status: 400 });
  if (formaat === "csv") {
    return bestand(
      naarCsv(rapporten[sleutel]),
      `nieuwbouw-${sleutel}-${datum}.csv`,
      "text/csv; charset=utf-8",
    );
  }
  const werkmap = await naarExcel([rapporten[sleutel]], {
    project: project.naam,
    datum,
  });
  return bestand(werkmap, `nieuwbouw-${sleutel}-${datum}.xlsx`, XLSX);
}
