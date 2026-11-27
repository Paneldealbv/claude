import "server-only";
import { cache } from "react";
import { z } from "zod";
import { naarCenten } from "@/lib/ai/controles";
import { isVastgelopen } from "@/lib/ai/voorstel";
import {
  HerkenningSchema,
  type Aandachtspunt,
  type Herkenning,
} from "@/lib/ai/schema";
import type { DocumentSoort } from "@/lib/labels";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/*
 * AI-voorstellen (document_extractions). Een voorstel telt nergens mee: pas
 * het document dat iemand na controle opslaat en boekt, telt.
 */

export type VoorstelStatus = Database["public"]["Enums"]["extraction_status"];

/** Voorstellen die nog aandacht nodig hebben. */
export const OPEN_VOORSTELLEN: VoorstelStatus[] = [
  "wachtrij",
  "bezig",
  "te_controleren",
  "mislukt",
];

const PuntSchema = z.object({
  soort: z.enum(["ontbreekt", "klopt-niet", "onzeker", "duplicaat"]),
  veld: z.string(),
  tekst: z.string(),
  href: z.string().optional(),
});

export type VoorstelRij = {
  id: string;
  status: VoorstelStatus;
  vastgelopen: boolean;
  bestand: { id: string; naam: string; type: string };
  soort: DocumentSoort | null;
  leverancier: string | null;
  nummer: string | null;
  datum: string | null;
  /** Centen zoals op het document (creditnota positief). */
  totaal: number | null;
  punten: Aandachtspunt[];
  fout: string | null;
  aangemaakt: string;
};

export type Voorstel = VoorstelRij & {
  herkenning: Herkenning | null;
  leverancierId: string | null;
  documentId: string | null;
};

const KOLOMMEN =
  "id, status, result, issues, error, created_at, updated_at, suggested_supplier_id, cost_document_id, files (id, original_name, mime_type), suppliers (name)" as const;

type Ruw = {
  id: string;
  status: VoorstelStatus;
  result: unknown;
  issues: unknown;
  error: string | null;
  created_at: string;
  updated_at: string;
  suggested_supplier_id: string | null;
  cost_document_id: string | null;
  files: { id: string; original_name: string; mime_type: string } | null;
  suppliers: { name: string } | null;
};

function omzetten(r: Ruw, nu: number): Voorstel | null {
  if (!r.files) return null;
  const gelezen = r.result ? HerkenningSchema.safeParse(r.result) : null;
  const h = gelezen?.success ? gelezen.data : null;
  const punten = z.array(PuntSchema).safeParse(r.issues);
  return {
    id: r.id,
    status: r.status,
    vastgelopen: isVastgelopen(r.status, r.updated_at, nu),
    bestand: {
      id: r.files.id,
      naam: r.files.original_name,
      type: r.files.mime_type,
    },
    soort: h?.soort.waarde ?? null,
    leverancier: r.suppliers?.name ?? h?.leverancier.waarde ?? null,
    nummer: h?.documentnummer.waarde ?? null,
    datum: h?.documentdatum.waarde ?? null,
    totaal: naarCenten(h?.totaal_incl.waarde ?? null),
    punten: punten.success ? punten.data : [],
    fout: r.error,
    aangemaakt: r.created_at,
    herkenning: h,
    leverancierId: r.suggested_supplier_id,
    documentId: r.cost_document_id,
  };
}

/** Open voorstellen, nieuwste eerst. */
export const laadVoorstellen = cache(
  async (projectId: string): Promise<VoorstelRij[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("document_extractions")
      .select(KOLOMMEN)
      .eq("project_id", projectId)
      .in("status", OPEN_VOORSTELLEN)
      .order("created_at", { ascending: false })
      .limit(100);
    const nu = Date.now();
    return (data ?? [])
      .map((r) => omzetten(r as Ruw, nu))
      .filter((v): v is Voorstel => v !== null);
  },
);

export async function laadVoorstel(
  projectId: string,
  id: string,
): Promise<Voorstel | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_extractions")
    .select(KOLOMMEN)
    .eq("project_id", projectId)
    .eq("id", id)
    .maybeSingle();
  return data ? omzetten(data as Ruw, Date.now()) : null;
}
