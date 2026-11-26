"use server";

import { z } from "zod";
import { getActiefProject, getGebruiker } from "@/lib/auth";
import { controleerBestand, TOEGESTANE_TYPES } from "@/lib/bestanden";
import { createClient } from "@/lib/supabase/server";
import { dbFout } from "./fouten";

/*
 * Uploaden gaat in drie stappen, zodat ook grote scans en telefoonfoto's
 * (tot 20 MB) rechtstreeks naar de privé opslag gaan:
 *  1. bestandVoorbereiden: controle + eenmalige upload-URL (alleen bewerkers)
 *  2. de browser uploadt het bestand naar die URL
 *  3. bestandRegistreren: de server controleert het opgeslagen bestand en
 *     legt het vast in de tabel files
 * De SHA-256 wordt in de browser berekend en dient om dubbele uploads te
 * herkennen.
 */

const metaSchema = z.object({
  naam: z.string().trim().min(1).max(255),
  type: z.string(),
  grootte: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export type Voorbereiding =
  | { status: "upload"; pad: string; token: string }
  | { status: "bestaat"; bestandId: string; naam: string }
  | { status: "fout"; fout: string };

export type Registratie =
  { status: "ok"; bestandId: string } | { status: "fout"; fout: string };

async function bewerkbaarProject() {
  await getGebruiker();
  const project = await getActiefProject();
  if (project.rol === "lezer")
    throw new Error("Je hebt alleen leesrechten in dit project.");
  return project;
}

export async function bestandVoorbereiden(
  meta: z.infer<typeof metaSchema>,
): Promise<Voorbereiding> {
  let project;
  try {
    project = await bewerkbaarProject();
  } catch (e) {
    return { status: "fout", fout: (e as Error).message };
  }
  const invoer = metaSchema.safeParse(meta);
  if (!invoer.success) return { status: "fout", fout: "Ongeldig bestand." };
  const probleem = controleerBestand(invoer.data.type, invoer.data.grootte);
  if (probleem) return { status: "fout", fout: probleem };

  const supabase = await createClient();
  const { data: bestaand } = await supabase
    .from("files")
    .select("id, original_name")
    .eq("project_id", project.id)
    .eq("sha256", invoer.data.sha256)
    .maybeSingle();
  if (bestaand)
    return {
      status: "bestaat",
      bestandId: bestaand.id,
      naam: bestaand.original_name,
    };

  const pad = `${project.id}/${crypto.randomUUID()}.${TOEGESTANE_TYPES[invoer.data.type]}`;
  const { data, error } = await supabase.storage
    .from("documenten")
    .createSignedUploadUrl(pad);
  if (error || !data) {
    console.error("[opslag]", error?.message);
    return {
      status: "fout",
      fout: "Uploaden is nu niet mogelijk. Probeer het opnieuw.",
    };
  }
  return { status: "upload", pad: data.path, token: data.token };
}

export async function bestandRegistreren(
  meta: z.infer<typeof metaSchema> & { pad: string },
): Promise<Registratie> {
  let project;
  try {
    project = await bewerkbaarProject();
  } catch (e) {
    return { status: "fout", fout: (e as Error).message };
  }
  const invoer = metaSchema.extend({ pad: z.string() }).safeParse(meta);
  if (!invoer.success || !invoer.data.pad.startsWith(`${project.id}/`)) {
    return { status: "fout", fout: "Ongeldig bestand." };
  }

  // Controleer wat er werkelijk is opgeslagen (grootte en type).
  const supabase = await createClient();
  const { data: info, error: infoFout } = await supabase.storage
    .from("documenten")
    .info(invoer.data.pad);
  if (infoFout || !info)
    return { status: "fout", fout: "Het bestand is niet goed aangekomen." };
  const grootte = info.size ?? 0;
  const type = (info.contentType ?? "").split(";")[0];
  const probleem = controleerBestand(type, grootte);
  if (probleem || grootte !== invoer.data.grootte) {
    await supabase.storage.from("documenten").remove([invoer.data.pad]);
    return {
      status: "fout",
      fout: probleem ?? "Het bestand is niet goed aangekomen.",
    };
  }

  const { data, error } = await supabase
    .from("files")
    .insert({
      project_id: project.id,
      storage_path: invoer.data.pad,
      original_name: invoer.data.naam,
      mime_type: type,
      size_bytes: grootte,
      sha256: invoer.data.sha256,
    })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from("documenten").remove([invoer.data.pad]);
    return { status: "fout", fout: dbFout(error) };
  }
  return { status: "ok", bestandId: data.id };
}
