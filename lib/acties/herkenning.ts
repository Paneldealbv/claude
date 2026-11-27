"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { controleer, zoekLeverancier } from "@/lib/ai/controles";
import {
  AI_MODEL,
  AI_TYPEN,
  aiBeschikbaar,
  leesDocument,
} from "@/lib/ai/herkennen";
import { foutMetDetail, isVastgelopen, zuiverIds } from "@/lib/ai/voorstel";
import { vandaagIso } from "@/lib/datum";
import { documentKeuzes, documentOverzicht } from "@/lib/data/documenten";
import { laadLeveranciers } from "@/lib/data/offertes";
import type { Json, TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { dbFout } from "./fouten";
import { bewerkbaarProject, ruimBestandOp, tekst } from "./hulp";
import type { ActieStatus } from "./project";

/*
 * AI-documentherkenning (docs/ARCHITECTUUR.md § 5). De AI stelt voor, de
 * gebruiker beslist: een voorstel wordt pas een document als iemand het in
 * het controlescherm bevestigt en boekt (documentOpslaan).
 */

const MAX_PER_UUR = 30;
/** Grens van de Claude API voor één afbeelding. */
const MAX_FOTO_BYTES = 5 * 1024 * 1024;

function vernieuw() {
  revalidatePath("/te-controleren", "layout");
  revalidatePath("/documenten", "layout");
  revalidatePath("/dashboard");
}

const isAiType = (t: string): t is (typeof AI_TYPEN)[number] =>
  (AI_TYPEN as readonly string[]).includes(t);

/** Leest het bestand uit en slaat het voorstel met aandachtspunten op. */
async function verwerk(
  projectId: string,
  extractieId: string,
  bestand: { storage_path: string; mime_type: string; size_bytes: number },
) {
  const supabase = await createClient();
  const bijwerken = (velden: TablesUpdate<"document_extractions">) =>
    supabase
      .from("document_extractions")
      .update(velden)
      .eq("project_id", projectId)
      .eq("id", extractieId);
  try {
    await uitlezen(projectId, bestand, bijwerken);
  } catch (fout) {
    console.error("[ai] verwerken mislukt:", fout);
    await bijwerken({
      status: "mislukt",
      error: foutMetDetail(
        "Het uitlezen is mislukt. Probeer het opnieuw.",
        fout instanceof Error ? fout.message : null,
      ),
    });
  }
}

async function uitlezen(
  projectId: string,
  bestand: { storage_path: string; mime_type: string; size_bytes: number },
  bijwerken: (
    velden: TablesUpdate<"document_extractions">,
  ) => PromiseLike<unknown>,
) {
  const supabase = await createClient();
  if (!isAiType(bestand.mime_type)) {
    await bijwerken({
      status: "mislukt",
      error:
        "Dit bestandstype kan de AI niet lezen. Gebruik een PDF of een JPG/PNG-foto.",
    });
    return;
  }
  if (
    bestand.mime_type !== "application/pdf" &&
    bestand.size_bytes > MAX_FOTO_BYTES
  ) {
    await bijwerken({
      status: "mislukt",
      error:
        "De foto is te groot om uit te lezen (max. 5 MB). Upload hem opnieuw via deze pagina (dan wordt hij verkleind) of voer het document zelf in.",
    });
    return;
  }
  const { data: blob, error } = await supabase.storage
    .from("documenten")
    .download(bestand.storage_path);
  if (error || !blob) {
    await bijwerken({
      status: "mislukt",
      error: "Het bestand kon niet worden geopend.",
    });
    return;
  }

  const [keuzes, leveranciers, documenten] = await Promise.all([
    documentKeuzes(projectId),
    laadLeveranciers(projectId),
    documentOverzicht(projectId),
  ]);
  const contracten = keuzes.contracten.filter((c) => !c.geannuleerd);
  const vandaag = vandaagIso();
  const uitkomst = await leesDocument(
    { data: Buffer.from(await blob.arrayBuffer()), type: bestand.mime_type },
    {
      vandaag,
      categorieen: keuzes.categorieen,
      ruimtes: keuzes.ruimtes,
      leveranciers: leveranciers.map((l) => ({
        naam: l.naam,
        kvk: l.kvk,
        iban: l.iban,
      })),
      contracten: contracten.map((c) => ({
        id: c.id,
        titel: c.titel,
        leverancier: c.leverancier,
        nogTeFactureren: c.nogTeFactureren,
        regels: c.regels,
        termijnen: c.termijnen.map((t) => ({ id: t.id, label: t.label })),
      })),
    },
  );
  if (!uitkomst.ok) {
    await bijwerken({
      status: "mislukt",
      error: foutMetDetail(uitkomst.fout, uitkomst.detail),
    });
    return;
  }

  const leverancierId = zoekLeverancier(uitkomst.herkenning, leveranciers);
  const herkenning = zuiverIds(
    uitkomst.herkenning,
    {
      categorieen: new Set(keuzes.categorieen.map((c) => c.id)),
      ruimtes: new Set(keuzes.ruimtes.map((r) => r.id)),
      contracten: new Map(
        contracten.map((c) => [
          c.id,
          {
            leverancierId: c.leverancierId,
            regels: new Set(c.regels.map((r) => r.id)),
            termijnen: new Set(c.termijnen.map((t) => t.id)),
          },
        ]),
      ),
    },
    leverancierId,
  );
  const punten = controleer(herkenning, {
    leverancierId,
    vandaag,
    bestaande: documenten.map((d) => ({
      id: d.id,
      leverancierId: d.leverancierId,
      nummer: d.nummer,
      datum: d.datum,
      totaal: d.totaal,
      status: d.status,
    })),
  });
  await bijwerken({
    status: "te_controleren",
    model: uitkomst.model,
    result: herkenning as unknown as Json,
    issues: punten as unknown as Json,
    suggested_supplier_id: leverancierId,
    suggested_contract_id: herkenning.contract_id.waarde,
    duplicate_candidates: [
      ...new Set(
        punten
          .filter((p) => p.soort === "duplicaat" && p.href)
          .map((p) => p.href!.split("/").pop()!),
      ),
    ],
    error: null,
  });
}

export async function documentHerkennen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const bestandId = tekst(formData, "bestandId");
  if (!bestandId) return { fout: "Kies eerst een foto of PDF." };
  const handmatig = `/documenten/nieuw?bestand=${bestandId}${tekst(formData, "soort") === "bon" ? "&type=bon" : ""}`;

  const supabase = await createClient();
  const { data: bestand } = await supabase
    .from("files")
    .select("id, storage_path, mime_type, size_bytes")
    .eq("project_id", project.id)
    .eq("id", bestandId)
    .maybeSingle();
  if (!bestand) return { fout: "Bestand niet gevonden." };

  // Precies dit bestand is al ingevoerd?
  const { data: document } = await supabase
    .from("cost_documents")
    .select("id")
    .eq("project_id", project.id)
    .eq("file_id", bestandId)
    .neq("status", "vervallen")
    .limit(1)
    .maybeSingle();
  if (document) {
    return {
      fout: "Dit document is al ingevoerd.",
      link: `/documenten/${document.id}`,
    };
  }
  const { data: lopend } = await supabase
    .from("document_extractions")
    .select("id")
    .eq("project_id", project.id)
    .eq("file_id", bestandId)
    .in("status", ["wachtrij", "bezig", "te_controleren", "mislukt"])
    .limit(1)
    .maybeSingle();
  // Al een voorstel voor dit bestand: daar verder (eventueel opnieuw proberen).
  if (lopend) redirect(`/te-controleren/${lopend.id}`);

  // Zonder AI-sleutel: meteen zelf invoeren, met het bestand al gekoppeld.
  if (!aiBeschikbaar()) redirect(handmatig);
  if (!isAiType(bestand.mime_type)) {
    return {
      fout: "Dit bestandstype kan de AI niet lezen. Gebruik een PDF of een JPG/PNG-foto, of voer het document zelf in.",
      link: handmatig,
    };
  }
  const uurGeleden = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("document_extractions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)
    .gte("created_at", uurGeleden);
  if ((count ?? 0) >= MAX_PER_UUR) {
    return {
      fout: "Er zijn het afgelopen uur al veel documenten herkend. Probeer het later opnieuw of voer het document zelf in.",
      link: handmatig,
    };
  }

  const { data: rij, error } = await supabase
    .from("document_extractions")
    .insert({
      project_id: project.id,
      file_id: bestandId,
      status: "bezig",
      model: AI_MODEL,
    })
    .select("id")
    .single();
  if (error || !rij) return { fout: dbFout(error) };
  await verwerk(project.id, rij.id, bestand);
  vernieuw();
  redirect(`/te-controleren/${rij.id}`);
}

/** Nogmaals proberen na een mislukte herkenning. */
export async function opnieuwHerkennen(formData: FormData): Promise<void> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return;
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { data: voorstel } = await supabase
    .from("document_extractions")
    .select(
      "id, status, updated_at, files (storage_path, mime_type, size_bytes)",
    )
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!voorstel) redirect("/te-controleren");
  const opnieuw =
    voorstel.status === "mislukt" ||
    isVastgelopen(voorstel.status, voorstel.updated_at);
  if (!voorstel.files || !opnieuw || !aiBeschikbaar()) {
    redirect(`/te-controleren/${id}`);
  }
  await supabase
    .from("document_extractions")
    .update({ status: "bezig", error: null })
    .eq("project_id", project.id)
    .eq("id", id);
  await verwerk(project.id, id, voorstel.files);
  vernieuw();
  redirect(`/te-controleren/${id}`);
}

/** Voorstel weggooien (bijv. verkeerde foto); het bestand gaat mee weg. */
export async function voorstelVerwijderen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  if (tekst(formData, "bevestig") !== "ja") {
    return { fout: "Vink aan dat je het voorstel wilt verwijderen." };
  }
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { data: voorstel } = await supabase
    .from("document_extractions")
    .select("file_id, status")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!voorstel) return { fout: "Voorstel niet gevonden." };
  if (voorstel.status === "verwerkt") {
    return { fout: "Dit voorstel is al geboekt als document." };
  }
  const { error } = await supabase
    .from("document_extractions")
    .delete()
    .eq("project_id", project.id)
    .eq("id", id);
  if (error) return { fout: dbFout(error) };
  await ruimBestandOp(supabase, project.id, voorstel.file_id);
  vernieuw();
  redirect("/te-controleren");
}
