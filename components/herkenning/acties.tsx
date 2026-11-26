"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Melding, VerzendKnop } from "@/components/ui/form";
import { opnieuwHerkennen, voorstelVerwijderen } from "@/lib/acties/herkenning";
import type { ActieStatus } from "@/lib/acties/project";

const leeg: ActieStatus = {};

/** Na een mislukte of afgebroken poging: nog een keer laten uitlezen. */
export function OpnieuwUitlezen({ id }: { id: string }) {
  return (
    <form action={opnieuwHerkennen}>
      <input type="hidden" name="id" value={id} />
      <VerzendKnop variant="secundair" bezigTekst="Uitlezen…">
        <RefreshCw className="size-4" />
        Opnieuw uitlezen
      </VerzendKnop>
    </form>
  );
}

/** Voorstel weggooien, bijv. bij een verkeerde of onleesbare foto. */
export function VoorstelVerwijderen({ id }: { id: string }) {
  const [status, actie] = useActionState(voorstelVerwijderen, leeg);
  return (
    <form action={actie} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-muted text-sm">
        Bijvoorbeeld bij een verkeerde of onleesbare foto. Het bestand wordt ook
        verwijderd, tenzij het nog bij een ander stuk hoort.
      </p>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="bevestig"
          value="ja"
          className="accent-accent mt-0.5 size-4 shrink-0"
        />
        Ja, verwijder dit voorstel.
      </label>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <VerzendKnop variant="gevaar" bezigTekst="Verwijderen…">
        <Trash2 className="size-4" />
        Voorstel verwijderen
      </VerzendKnop>
    </form>
  );
}

/** Ververst de pagina zolang het uitlezen (in een ander venster) loopt. */
export function VerversTijdensUitlezen() {
  const router = useRouter();
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      // De pagina toont "afgebroken" na 2 minuten; daarna niet meer verversen.
      if (Date.now() - start > 150_000) return clearInterval(timer);
      router.refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
