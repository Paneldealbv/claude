import type { Metadata } from "next";
import Link from "next/link";
import { ProjectAanmakenFormulier } from "@/components/project/formulieren";
import { Melding } from "@/components/ui/form";
import { getGebruiker, getProjecten } from "@/lib/auth";
import { AuthKop } from "../kop";

export const metadata: Metadata = { title: "Welkom" };

export default async function WelkomPagina({
  searchParams,
}: PageProps<"/welkom">) {
  await getGebruiker();
  const projecten = await getProjecten();
  const bevestigd = (await searchParams).bevestigd === "1";

  return (
    <>
      {bevestigd && (
        <div className="mb-6">
          <Melding soort="succes">Je e-mailadres is bevestigd.</Melding>
        </div>
      )}
      <AuthKop
        titel={
          projecten.length
            ? "Nieuw woningproject"
            : "Welkom! Maak je woningproject aan"
        }
        tekst="Je wordt eigenaar van het project en kunt daarna anderen uitnodigen."
      />
      <ProjectAanmakenFormulier />
      <p className="text-muted mt-8 text-sm leading-relaxed">
        Ben je uitgenodigd voor een bestaand project? Open dan de
        uitnodigingslink die je hebt ontvangen.
        {projecten.length > 0 && (
          <>
            {" "}
            <Link
              href="/dashboard"
              className="text-accent-ink font-medium hover:underline"
            >
              Terug naar het dashboard
            </Link>
          </>
        )}
      </p>
    </>
  );
}
