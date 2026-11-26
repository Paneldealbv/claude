"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiefProject, getGebruiker } from "@/lib/auth";
import { STANDAARD_RUIMTES } from "@/lib/standaard-indeling";
import { createClient } from "@/lib/supabase/server";
import { dbFout } from "./fouten";
import type { ActieStatus } from "./project";

const tekst = (formData: FormData, naam: string) =>
  String(formData.get(naam) ?? "");

async function bewerkbaarProject() {
  await getGebruiker();
  const project = await getActiefProject();
  return {
    project,
    fout:
      project.rol === "lezer"
        ? "Je hebt alleen leesrechten in dit project."
        : null,
  };
}

function vernieuw() {
  revalidatePath("/ruimtes");
}

const ruimteSchema = z.object({
  naam: z
    .string()
    .trim()
    .min(1, { error: "Geef de ruimte een naam." })
    .max(80, { error: "Maximaal 80 tekens." }),
  verdieping: z.string().trim().max(40, { error: "Maximaal 40 tekens." }),
});

function veldfouten(error: z.ZodError) {
  const uit: Record<string, string> = {};
  for (const i of error.issues) uit[String(i.path[0])] ??= i.message;
  return uit;
}

export async function standaardRuimtesToevoegen(): Promise<void> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return;
  const supabase = await createClient();
  const { count } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id);
  if ((count ?? 0) > 0) return;
  const { error } = await supabase.from("rooms").insert(
    STANDAARD_RUIMTES.map((r, i) => ({
      project_id: project.id,
      name: r.naam,
      floor: r.verdieping,
      sort_order: i + 1,
    })),
  );
  if (error) throw new Error(dbFout(error));
  vernieuw();
}

export async function ruimteToevoegen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const waarden = {
    naam: tekst(formData, "naam"),
    verdieping: tekst(formData, "verdieping"),
  };
  const invoer = ruimteSchema.safeParse(waarden);
  if (!invoer.success) return { veldfouten: veldfouten(invoer.error), waarden };

  const supabase = await createClient();
  const { data: laatste } = await supabase
    .from("rooms")
    .select("sort_order")
    .eq("project_id", project.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const { error } = await supabase.from("rooms").insert({
    project_id: project.id,
    name: invoer.data.naam,
    floor: invoer.data.verdieping || null,
    sort_order: (laatste?.[0]?.sort_order ?? 0) + 1,
  });
  if (error) return { fout: dbFout(error), waarden };
  vernieuw();
  return { succes: `Ruimte "${invoer.data.naam}" toegevoegd.` };
}

export async function ruimteWijzigen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const waarden = {
    naam: tekst(formData, "naam"),
    verdieping: tekst(formData, "verdieping"),
  };
  const invoer = ruimteSchema.safeParse(waarden);
  if (!invoer.success) return { veldfouten: veldfouten(invoer.error), waarden };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ name: invoer.data.naam, floor: invoer.data.verdieping || null })
    .eq("id", tekst(formData, "id"));
  if (error) return { fout: dbFout(error), waarden };
  vernieuw();
  return { succes: "Ruimte opgeslagen." };
}

export async function ruimteVerplaatsen(formData: FormData): Promise<void> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return;
  const id = tekst(formData, "id");
  const omhoog = tekst(formData, "richting") === "omhoog";
  const supabase = await createClient();
  const { data: ruimtes } = await supabase
    .from("rooms")
    .select("id, sort_order")
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (!ruimtes) return;
  const index = ruimtes.findIndex((r) => r.id === id);
  const doel = omhoog ? index - 1 : index + 1;
  if (index < 0 || doel < 0 || doel >= ruimtes.length) return;
  [ruimtes[index], ruimtes[doel]] = [ruimtes[doel], ruimtes[index]];
  await Promise.all(
    ruimtes.map((r, i) =>
      r.sort_order === i + 1
        ? null
        : supabase
            .from("rooms")
            .update({ sort_order: i + 1 })
            .eq("id", r.id),
    ),
  );
  vernieuw();
}

export async function ruimteVerwijderen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const { count } = await supabase
    .from("room_allocations")
    .select("id", { count: "exact", head: true })
    .eq("room_id", id);
  if ((count ?? 0) > 0) {
    return {
      fout: "Aan deze ruimte zijn kosten gekoppeld. Haal die koppeling eerst weg.",
    };
  }
  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) return { fout: dbFout(error) };
  vernieuw();
  return { succes: "Ruimte verwijderd." };
}
