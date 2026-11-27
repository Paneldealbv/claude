"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { vandaagIso } from "@/lib/datum";
import { createClient } from "@/lib/supabase/server";
import { dbFout } from "./fouten";
import {
  bewerkbaarProject,
  datumOfLeeg,
  eersteFouten,
  logActie,
  tekst,
} from "./hulp";
import type { ActieStatus } from "./project";

/*
 * Declaraties bij het bouwdepot (fase 9). Opslaan, status en uitbetalen gaan
 * via databasefuncties (0012), zodat de controles altijd gelden: alleen
 * geboekte facturen, nooit meer dan de factuur of het bouwdepot, en bij
 * uitbetalen de betalingen in één keer.
 */

function vernieuw() {
  for (const pad of ["/financiering", "/documenten"]) {
    revalidatePath(pad, "layout");
  }
  revalidatePath("/dashboard");
  revalidatePath("/rapportages");
}

const kopSchema = z.object({
  depotId: z.uuid({ error: "Kies het bouwdepot." }),
  nummer: z.string().max(60, { error: "Maximaal 60 tekens." }),
  notities: z.string().max(2000, { error: "Maximaal 2000 tekens." }),
  ingediendOp: datumOfLeeg,
});

const regelsSchema = z
  .array(
    z.object({
      documentId: z.uuid(),
      bedrag: z.number().int().positive(),
    }),
  )
  .min(1)
  .max(200);

export async function declaratieOpslaan(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };

  const kop = kopSchema.safeParse({
    depotId: tekst(formData, "depotId"),
    nummer: tekst(formData, "nummer"),
    notities: tekst(formData, "notities"),
    ingediendOp: tekst(formData, "ingediendOp"),
  });
  if (!kop.success) {
    return {
      veldfouten: eersteFouten(kop.error),
      fout: "Controleer de gemarkeerde velden.",
    };
  }
  let ruw: unknown;
  try {
    ruw = JSON.parse(tekst(formData, "regels") || "[]");
  } catch {
    ruw = [];
  }
  const regels = regelsSchema.safeParse(ruw);
  if (!regels.success) {
    return {
      fout: "Kies minstens één factuur en vul bij elke gekozen factuur een bedrag in.",
    };
  }

  const id = tekst(formData, "id");
  const indienen = tekst(formData, "actie") === "indienen";
  const k = kop.data;
  const supabase = await createClient();
  const { data: opgeslagen, error } = await supabase.rpc("save_depot_claim", {
    p_claim: {
      id: id || null,
      project_id: project.id,
      funding_source_id: k.depotId,
      claim_number: k.nummer || null,
      status: indienen ? "ingediend" : "concept",
      submitted_on: indienen ? k.ingediendOp || vandaagIso() : null,
      notes: k.notities || null,
    },
    p_lines: regels.data.map((r) => ({
      cost_document_id: r.documentId,
      amount_cents: r.bedrag,
    })),
  });
  if (error || !opgeslagen) return { fout: dbFout(error) };

  await logActie(
    project.id,
    indienen ? "declaratie_ingediend" : "declaratie_opgeslagen",
    "depot_claims",
    opgeslagen,
    {
      nummer: k.nummer || null,
      bedrag: regels.data.reduce((a, r) => a + r.bedrag, 0),
    },
  );
  vernieuw();
  redirect(`/financiering/declaraties/${opgeslagen}`);
}

const STATUSSEN = ["concept", "ingediend", "afgewezen"] as const;

export async function declaratieStatus(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const id = tekst(formData, "id");
  const status = z.enum(STATUSSEN).safeParse(tekst(formData, "status"));
  const datum = datumOfLeeg.safeParse(tekst(formData, "datum"));
  if (!status.success || !z.uuid().safeParse(id).success) {
    return { fout: "Onbekende actie." };
  }
  if (!datum.success) {
    return {
      veldfouten: { datum: "Vul een geldige datum in als DD-MM-JJJJ." },
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_depot_claim_status", {
    p_claim: id,
    p_status: status.data,
    p_date: datum.data || vandaagIso(),
  });
  if (error) return { fout: dbFout(error) };
  await logActie(project.id, `declaratie_${status.data}`, "depot_claims", id);
  vernieuw();
  return {
    succes:
      status.data === "ingediend"
        ? "Declaratie ingediend."
        : status.data === "afgewezen"
          ? "Declaratie afgewezen; hij telt niet meer mee."
          : "Declaratie teruggezet naar concept.",
  };
}

export async function declaratieUitbetalen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const id = tekst(formData, "id");
  const datum = tekst(formData, "datum");
  if (!z.uuid().safeParse(id).success) return { fout: "Onbekende declaratie." };
  if (!datum || !datumOfLeeg.safeParse(datum).success) {
    return {
      veldfouten: { datum: "Vul de datum van de uitbetaling in (DD-MM-JJJJ)." },
    };
  }
  const supabase = await createClient();
  const { data: claim } = await supabase
    .from("depot_claims")
    .select("claim_number, amount_cents")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.rpc("pay_out_depot_claim", {
    p_claim: id,
    p_date: datum,
  });
  if (error) return { fout: dbFout(error) };
  await logActie(project.id, "declaratie_uitbetaald", "depot_claims", id, {
    nummer: claim?.claim_number ?? null,
    bedrag: claim?.amount_cents ?? null,
  });
  vernieuw();
  return {
    succes:
      "Uitbetaald. De betalingen uit het bouwdepot zijn bij de facturen vastgelegd.",
  };
}

export async function declaratieVerwijderen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  if (tekst(formData, "bevestig") !== "ja") {
    return { fout: "Vink aan dat je de declaratie wilt verwijderen." };
  }
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { data: claim } = await supabase
    .from("depot_claims")
    .select("status")
    .eq("project_id", project.id)
    .eq("id", id)
    .maybeSingle();
  if (!claim) return { fout: "Declaratie niet gevonden." };
  if (claim.status === "uitbetaald") {
    return {
      fout: "Een uitbetaalde declaratie blijft bewaard: de betalingen uit het bouwdepot horen erbij.",
    };
  }
  const { error } = await supabase
    .from("depot_claims")
    .delete()
    .eq("project_id", project.id)
    .eq("id", id);
  if (error) return { fout: dbFout(error) };
  vernieuw();
  redirect("/financiering");
}
