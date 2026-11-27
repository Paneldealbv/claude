import { ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import type { BestandWeergave } from "@/lib/data/bestanden";

/**
 * Kaart met het originele document: PDF in de pagina, foto als afbeelding,
 * anders een knop om het te openen. De link is tijdelijk (1 uur) en alleen
 * voor projectleden.
 */
export function BestandKaart({
  bestand,
  omschrijving,
  toevoegenHref,
}: {
  bestand: BestandWeergave | null;
  /** Bijv. "Offerte" of "Factuur", voor de toegankelijke naam. */
  omschrijving: string;
  /** Link om alsnog een bestand toe te voegen (als dat mag). */
  toevoegenHref?: string;
}) {
  const isPdf = bestand?.type === "application/pdf";
  const isAfbeelding =
    (bestand?.type.startsWith("image/") ?? false) &&
    !/hei[cf]/.test(bestand?.type ?? "");
  return (
    <Card aria-labelledby="document-titel" className="overflow-hidden">
      <CardHeader
        id="document-titel"
        title="Document"
        description={bestand ? bestand.naam : undefined}
        action={
          bestand?.url && (
            <a
              href={bestand.url}
              target="_blank"
              rel="noopener noreferrer"
              className={knopKlassen("secundair", "px-3 py-2")}
            >
              <ExternalLink className="size-4" />
              Openen
            </a>
          )
        }
        className="pb-4"
      />
      {bestand ? (
        bestand.url && isPdf ? (
          <iframe
            src={bestand.url}
            title={`${omschrijving}: ${bestand.naam}`}
            className="border-border h-[70vh] min-h-[420px] w-full border-t"
          />
        ) : bestand.url && isAfbeelding ? (
          // Tijdelijke, persoonlijke link uit de privé opslag; geen
          // beeldoptimalisatie via de server.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bestand.url}
            alt={`${omschrijving}: ${bestand.naam}`}
            className="border-border max-h-[70vh] w-full border-t object-contain"
          />
        ) : (
          <p className="text-muted border-border border-t px-5 py-4 text-sm sm:px-6">
            Dit bestand kan niet in de pagina worden getoond. Gebruik
            &quot;Openen&quot; om het te bekijken of te downloaden.
          </p>
        )
      ) : (
        <p className="text-muted border-border flex items-center gap-2 border-t px-5 py-4 text-sm sm:px-6">
          <FileText className="size-4 shrink-0" />
          Geen document bewaard.
          {toevoegenHref && (
            <Link
              href={toevoegenHref}
              className="text-accent-ink font-medium hover:underline"
            >
              Toevoegen
            </Link>
          )}
        </p>
      )}
    </Card>
  );
}
