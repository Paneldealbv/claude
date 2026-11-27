import "server-only";
import { cache } from "react";
import { berekenProject } from "@/lib/finance";
import {
  KOLOMMEN,
  naarInvoer,
  type DatabaseRijen,
} from "@/lib/finance/uit-database";
import { vandaagIso } from "@/lib/datum";
import { createClient } from "@/lib/supabase/server";

/**
 * Haalt alle financiële gegevens van een project op (via RLS: alleen als de
 * gebruiker lid is) en zet ze om naar de invoer van de rekenlogica.
 * Eén keer per verzoek dankzij cache().
 */
export const laadProjectInvoer = cache(async (projectId: string) => {
  const supabase = await createClient();
  const [
    categories,
    budget_lines,
    contracts,
    contract_lines,
    contract_changes,
    contract_installments,
    cost_documents,
    cost_lines,
    rooms,
    room_allocations,
    payments,
    funding_sources,
  ] = await Promise.all([
    supabase
      .from("categories")
      .select(KOLOMMEN.categories)
      .eq("project_id", projectId),
    supabase
      .from("budget_lines")
      .select(KOLOMMEN.budget_lines)
      .eq("project_id", projectId),
    supabase
      .from("contracts")
      .select(KOLOMMEN.contracts)
      .eq("project_id", projectId),
    supabase
      .from("contract_lines")
      .select(KOLOMMEN.contract_lines)
      .eq("project_id", projectId),
    supabase
      .from("contract_changes")
      .select(KOLOMMEN.contract_changes)
      .eq("project_id", projectId),
    supabase
      .from("contract_installments")
      .select(KOLOMMEN.contract_installments)
      .eq("project_id", projectId),
    supabase
      .from("cost_documents")
      .select(KOLOMMEN.cost_documents)
      .eq("project_id", projectId),
    supabase
      .from("cost_lines")
      .select(KOLOMMEN.cost_lines)
      .eq("project_id", projectId),
    supabase.from("rooms").select(KOLOMMEN.rooms).eq("project_id", projectId),
    supabase
      .from("room_allocations")
      .select(KOLOMMEN.room_allocations)
      .eq("project_id", projectId),
    supabase
      .from("payments")
      .select(KOLOMMEN.payments)
      .eq("project_id", projectId),
    supabase
      .from("funding_sources")
      .select(KOLOMMEN.funding_sources)
      .eq("project_id", projectId),
  ]);

  const alle = {
    categories,
    budget_lines,
    contracts,
    contract_lines,
    contract_changes,
    contract_installments,
    cost_documents,
    cost_lines,
    rooms,
    room_allocations,
    payments,
    funding_sources,
  };
  for (const [tabel, r] of Object.entries(alle)) {
    if (r.error)
      throw new Error(
        `Gegevens ophalen mislukt (${tabel}): ${r.error.message}`,
      );
  }

  const rijen = Object.fromEntries(
    Object.entries(alle).map(([tabel, r]) => [tabel, r.data ?? []]),
  ) as DatabaseRijen;
  return naarInvoer(rijen);
});

/** Invoer én doorgerekende uitkomst voor het actieve project. */
export const laadProjectResultaat = cache(async (projectId: string) => {
  const invoer = await laadProjectInvoer(projectId);
  const vandaag = vandaagIso();
  return { invoer, vandaag, resultaat: berekenProject(invoer, { vandaag }) };
});
