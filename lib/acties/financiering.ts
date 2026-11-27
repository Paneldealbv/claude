"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hypotheekDelen } from "@/lib/financiering";
import { parseProcent } from "@/lib/format";
import { BRON_TYPE, HOOFDBRONNEN } from "@/lib/labels";
import type { Json } from "@/lib/supabase/database.types";
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
 * Financieringsbronnen (fase 9). Een hypotheek met bouwdepot wordt in één
 * keer opgeslagen met zijn delen (save_funding_source), zodat de controle
 * "delen = hypotheekbedrag" nooit halverwege faalt en betalingen aan het
 * bouwdepot gekoppeld blijven.
 */

function vernieuw() {
  for (const pad of ["/financiering", "/documenten"]) {
    revalidatePath(pad, "layout");
  }
  revalidatePath("/dashboard");
  revalidatePath("/rapportages");
}

const bronSchema = z
  .object({
    type: z.enum(HOOFDBRONNEN, { error: "Kies het soort bron." }),
    naam: z
      .string()
      .min(1, { error: "Geef de bron een naam." })
      .max(120, { error: "Maximaal 120 tekens." }),
    verstrekker: z.string().max(120, { error: "Maximaal 120 tekens." }),
    bedrag: z.string().regex(/^\d+$/, {
      error: "Vul het bedrag in, bijvoorbeeld 400.000.",
    }),
    rente: z.string(),
    start: datumOfLeeg,
    eind: datumOfLeeg,
    bouwdepot: z.string().regex(/^(\d+)?$/, {
      error: "Vul een geldig bedrag in, bijvoorbeeld 100.000.",
    }),
    depotEind: datumOfLeeg,
    notities: z.string().max(2000, { error: "Maximaal 2000 tekens." }),
  })
  .superRefine((b, ctx) => {
    if (b.rente) {
      const bp = parseProcent(b.rente);
      if (bp === null || bp > 10000) {
        ctx.addIssue({
          code: "custom",
          path: ["rente"],
          message: "Vul de rente in als percentage, bijvoorbeeld 3,85.",
        });
      }
    }
    if (b.start && b.eind && b.eind < b.start) {
      ctx.addIssue({
        code: "custom",
        path: ["eind"],
        message: "De einddatum ligt vóór de begindatum.",
      });
    }
  });

export async function bronOpslaan(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };

  const invoer = bronSchema.safeParse({
    type: tekst(formData, "type"),
    naam: tekst(formData, "naam"),
    verstrekker: tekst(formData, "verstrekker"),
    bedrag: tekst(formData, "bedrag"),
    rente: tekst(formData, "rente"),
    start: tekst(formData, "start"),
    eind: tekst(formData, "eind"),
    bouwdepot: tekst(formData, "bouwdepot"),
    depotEind: tekst(formData, "depotEind"),
    notities: tekst(formData, "notities"),
  });
  if (!invoer.success) {
    return {
      veldfouten: eersteFouten(invoer.error),
      fout: "Controleer de gemarkeerde velden.",
    };
  }
  const b = invoer.data;
  const bedrag = Number(b.bedrag);

  let delen: Json[] = [];
  if (b.type === "hypotheek") {
    const verdeling = hypotheekDelen(
      bedrag,
      b.bouwdepot ? Number(b.bouwdepot) : null,
    );
    if (verdeling && "fout" in verdeling) {
      return {
        veldfouten: { bouwdepot: verdeling.fout },
        fout: "Controleer de gemarkeerde velden.",
      };
    }
    if (verdeling) {
      delen = [
        {
          type: "bouwdepot",
          name: BRON_TYPE.bouwdepot.tekst,
          amount_cents: verdeling.depot,
          end_date: b.depotEind || null,
        },
        {
          type: "overige_hypotheekruimte",
          name: BRON_TYPE.overige_hypotheekruimte.tekst,
          amount_cents: verdeling.overig,
        },
      ];
    }
  }

  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { data: opgeslagen, error } = await supabase.rpc(
    "save_funding_source",
    {
      p_source: {
        id: id || null,
        project_id: project.id,
        type: b.type,
        name: b.naam,
        lender: b.verstrekker || null,
        amount_cents: bedrag,
        interest_rate_bp: b.rente ? parseProcent(b.rente) : null,
        start_date: b.start || null,
        end_date: b.eind || null,
        notes: b.notities || null,
      },
      p_parts: delen,
    },
  );
  if (error || !opgeslagen) return { fout: dbFout(error) };

  await logActie(
    project.id,
    id ? "financiering_gewijzigd" : "financiering_toegevoegd",
    "funding_sources",
    opgeslagen,
    { naam: b.naam, bedrag },
  );
  vernieuw();
  redirect("/financiering");
}

export async function bronVerwijderen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  if (tekst(formData, "bevestig") !== "ja") {
    return { fout: "Vink aan dat je de bron wilt verwijderen." };
  }
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { data: bron } = await supabase
    .from("funding_sources")
    .select("id, name, parent_source_id")
    .eq("project_id", project.id)
    .eq("id", id)
    .is("parent_source_id", null)
    .maybeSingle();
  if (!bron) return { fout: "Bron niet gevonden." };

  // Declaraties bij het bouwdepot van deze hypotheek? Dan eerst die weg.
  const { data: delen } = await supabase
    .from("funding_sources")
    .select("id")
    .eq("project_id", project.id)
    .eq("parent_source_id", id);
  const ids = [id, ...(delen ?? []).map((d) => d.id)];
  const { count } = await supabase
    .from("depot_claims")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)
    .in("funding_source_id", ids);
  if (count) {
    return {
      fout: "Er zijn declaraties bij het bouwdepot van deze bron. Verwijder die eerst.",
    };
  }

  // Betalingen uit deze bron blijven bestaan, maar zonder bron.
  const { error } = await supabase
    .from("funding_sources")
    .delete()
    .eq("project_id", project.id)
    .eq("id", id);
  if (error) return { fout: dbFout(error) };
  await logActie(project.id, "financiering_verwijderd", "funding_sources", id, {
    naam: bron.name,
  });
  vernieuw();
  redirect("/financiering");
}

/** Betaling(en) zonder bron alsnog aan een bron koppelen. */
export async function betalingenBronToewijzen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const bronId = tekst(formData, "bronId");
  const ids = formData
    .getAll("betaling")
    .map(String)
    .filter((i) => z.uuid().safeParse(i).success);
  if (!z.uuid().safeParse(bronId).success) {
    return { fout: "Kies de bron waaruit is betaald." };
  }
  if (!ids.length) return { fout: "Kies minstens één betaling." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .update({ funding_source_id: bronId })
    .eq("project_id", project.id)
    .in("id", ids)
    .is("funding_source_id", null)
    .select("id");
  if (error) return { fout: dbFout(error) };
  vernieuw();
  // De lijst verdwijnt als alles gekoppeld is: melding bovenaan de pagina.
  redirect(`/financiering?gekoppeld=${data?.length ?? 0}`);
}
