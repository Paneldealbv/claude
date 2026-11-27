"use client";

import { PencilLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { BestandUpload } from "@/components/invoer/bestand-upload";
import { BlijvendFormulier, Melding, VerzendKnop } from "@/components/ui/form";
import { documentHerkennen } from "@/lib/acties/herkenning";
import type { ActieStatus } from "@/lib/acties/project";

const leeg: ActieStatus = {};

/** Wat de AI kan lezen. HEIC staat er bewust niet bij: dan levert een iPhone JPG. */
const AI_ACCEPT = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Foto of PDF kiezen en laten uitlezen; daarna naar het controlescherm. */
export function HerkenFormulier({
  beschikbaar,
  camera,
}: {
  /** Is de AI ingesteld? Zo niet: uploaden en zelf invoeren. */
  beschikbaar: boolean;
  /** Op een telefoon meteen de camera openen. */
  camera: boolean;
}) {
  const [status, actie, bezig] = useActionState(documentHerkennen, leeg);
  const [bestandId, setBestandId] = useState<string | null>(null);

  return (
    <BlijvendFormulier actie={actie} bezig={bezig} className="space-y-5">
      {camera && <input type="hidden" name="soort" value="bon" />}
      <BestandUpload
        label={camera ? "Foto van de bon of factuur" : "Factuur of bon"}
        accept={AI_ACCEPT}
        verkleinFoto
        camera={camera}
        leegTekst={
          camera ? "Maak een foto of kies er een" : "Kies een PDF of foto"
        }
        onGekozen={(b) => setBestandId(b?.id ?? null)}
      />
      {status.fout && (
        <Melding soort="fout">
          {status.fout}
          {status.link && (
            <>
              {" "}
              <Link href={status.link} className="font-semibold underline">
                {status.link.startsWith("/documenten/nieuw")
                  ? "Zelf invoeren"
                  : "Bekijk het document"}
              </Link>
            </>
          )}
        </Melding>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <VerzendKnop
          disabled={!bestandId}
          bezigTekst={beschikbaar ? "Uitlezen…" : "Openen…"}
        >
          {beschikbaar ? (
            <>
              <Sparkles className="size-4" />
              Uitlezen
            </>
          ) : (
            <>
              <PencilLine className="size-4" />
              Verder: zelf invoeren
            </>
          )}
        </VerzendKnop>
        {beschikbaar && (
          <p className="text-muted text-xs" aria-live="polite">
            {bezig
              ? "De AI leest het document. Dit duurt meestal 10 tot 40 seconden; laat deze pagina open."
              : "Daarna controleer je het voorstel. Er wordt niets geboekt zonder jouw bevestiging."}
          </p>
        )}
      </div>
    </BlijvendFormulier>
  );
}
