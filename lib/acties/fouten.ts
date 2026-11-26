import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Foutmeldingen van onze databasefuncties zijn al in het Nederlands
 * geschreven (zie supabase/migrations). Alle andere fouten worden algemeen
 * gehouden, zodat er geen technische details naar de browser lekken.
 */
const EIGEN_CODES = new Set(["42501", "22023", "23505", "P0002", "23514"]);
const TECHNISCH =
  /violates|permission denied|relation|column|constraint|syntax/i;

export function dbFout(fout: PostgrestError | null): string {
  // Technische details alleen in de serverlogs, nooit naar de browser.
  if (fout) {
    console.error(
      "[database]",
      fout.code,
      fout.message,
      fout.details ?? "",
      fout.hint ?? "",
    );
  }
  if (
    fout &&
    EIGEN_CODES.has(fout.code) &&
    /^[A-Z]/.test(fout.message) &&
    !TECHNISCH.test(fout.message)
  ) {
    return fout.message;
  }
  if (fout?.code === "42501") return "Je hebt hiervoor geen rechten.";
  return "Er ging iets mis bij het opslaan. Probeer het opnieuw.";
}
