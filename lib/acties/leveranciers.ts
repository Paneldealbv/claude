"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbFout } from "./fouten";
import { bewerkbaarProject, eersteFouten, tekst } from "./hulp";
import type { ActieStatus } from "./project";

const leeg = (w: string) => w === "";

const leverancierSchema = z.object({
  naam: z
    .string()
    .min(1, { error: "Vul de naam in." })
    .max(120, { error: "Maximaal 120 tekens." }),
  contactpersoon: z.string().max(120, { error: "Maximaal 120 tekens." }),
  email: z
    .string()
    .max(254)
    .refine((w) => leeg(w) || z.email().safeParse(w).success, {
      error: "Vul een geldig e-mailadres in.",
    }),
  telefoon: z.string().max(40, { error: "Maximaal 40 tekens." }),
  // IBAN zonder spaties, hoofdletters (zoals de database verwacht).
  iban: z
    .string()
    .transform((w) => w.replace(/\s+/g, "").toUpperCase())
    .refine((w) => leeg(w) || /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(w), {
      error: "Vul een geldig IBAN in, bijv. NL91 ABNA 0417 1643 00.",
    }),
  kvk: z
    .string()
    .transform((w) => w.replace(/\D+/g, ""))
    .refine((w) => leeg(w) || /^[0-9]{8}$/.test(w), {
      error: "Een KvK-nummer heeft 8 cijfers.",
    }),
  btwNummer: z.string().max(20, { error: "Maximaal 20 tekens." }),
  notities: z.string().max(2000, { error: "Maximaal 2000 tekens." }),
});

const velden = [
  "naam",
  "contactpersoon",
  "email",
  "telefoon",
  "iban",
  "kvk",
  "btwNummer",
  "notities",
] as const;

function vernieuw() {
  revalidatePath("/leveranciers", "layout");
  revalidatePath("/offertes", "layout");
  revalidatePath("/contracten", "layout");
}

export async function leverancierOpslaan(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  const waarden = Object.fromEntries(
    velden.map((v) => [v, tekst(formData, v)]),
  );
  const invoer = leverancierSchema.safeParse(waarden);
  if (!invoer.success)
    return { veldfouten: eersteFouten(invoer.error), waarden };

  const d = invoer.data;
  const rij = {
    name: d.naam,
    contact_person: d.contactpersoon || null,
    email: d.email || null,
    phone: d.telefoon || null,
    iban: d.iban || null,
    kvk_number: d.kvk || null,
    vat_number: d.btwNummer || null,
    notes: d.notities || null,
  };
  const id = tekst(formData, "id");
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase
      .from("suppliers")
      .update(rij)
      .eq("project_id", project.id)
      .eq("id", id);
    if (error) return { fout: dbFout(error), waarden };
    vernieuw();
    return { succes: "Leverancier opgeslagen." };
  }
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ ...rij, project_id: project.id })
    .select("id")
    .single();
  if (error || !data) return { fout: dbFout(error), waarden };
  vernieuw();
  redirect(`/leveranciers/${data.id}`);
}

export async function leverancierVerwijderen(
  _vorige: ActieStatus,
  formData: FormData,
): Promise<ActieStatus> {
  const { project, fout } = await bewerkbaarProject();
  if (fout) return { fout };
  if (tekst(formData, "bevestig") !== "ja")
    return { fout: "Vink aan dat je de leverancier wilt verwijderen." };
  const id = tekst(formData, "id");
  const supabase = await createClient();
  const tel = (tabel: "quotes" | "contracts" | "cost_documents") =>
    supabase
      .from(tabel)
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", id);
  const [offertes, contracten, documenten] = await Promise.all([
    tel("quotes"),
    tel("contracts"),
    tel("cost_documents"),
  ]);
  if (
    (offertes.count ?? 0) + (contracten.count ?? 0) + (documenten.count ?? 0) >
    0
  ) {
    return {
      fout: "Deze leverancier heeft offertes, contracten of documenten. Die blijven bewaard; verwijderen kan daarom niet.",
    };
  }
  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("project_id", project.id)
    .eq("id", id);
  if (error) return { fout: dbFout(error) };
  vernieuw();
  redirect("/leveranciers");
}
