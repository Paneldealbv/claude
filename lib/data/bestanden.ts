import "server-only";
import { createClient } from "@/lib/supabase/server";

export type BestandWeergave = {
  id: string;
  naam: string;
  type: string;
  grootte: number;
  /** Tijdelijke link (1 uur) om het bestand te bekijken. */
  url: string | null;
};

/** Bestand met een tijdelijke, persoonlijke bekijklink (via RLS: alleen leden). */
export async function bestandMetLink(
  bestandId: string | null,
): Promise<BestandWeergave | null> {
  if (!bestandId) return null;
  const supabase = await createClient();
  const { data: f } = await supabase
    .from("files")
    .select("id, storage_path, original_name, mime_type, size_bytes")
    .eq("id", bestandId)
    .maybeSingle();
  if (!f) return null;
  const { data } = await supabase.storage
    .from("documenten")
    .createSignedUrl(f.storage_path, 60 * 60);
  return {
    id: f.id,
    naam: f.original_name,
    type: f.mime_type,
    grootte: f.size_bytes,
    url: data?.signedUrl ?? null,
  };
}
