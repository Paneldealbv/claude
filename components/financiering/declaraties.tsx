"use client";

import { BadgeCheck, RotateCcw, Send, Trash2, CircleX } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { tekstvakKlassen } from "@/components/offertes/formulieren";
import { BedragVeld } from "@/components/ui/bedrag-veld";
import { DatumVeld } from "@/components/ui/datum-veld";
import {
  BlijvendFormulier,
  Melding,
  Veld,
  VerzendKnop,
} from "@/components/ui/form";
import {
  declaratieOpslaan,
  declaratieStatus,
  declaratieUitbetalen,
  declaratieVerwijderen,
} from "@/lib/acties/declaraties";
import type { ActieStatus } from "@/lib/acties/project";
import { cn } from "@/lib/cn";
import type { DeclarabelDocument } from "@/lib/data/financiering";
import { formatDatum, formatEuro } from "@/lib/format";
import type { DeclaratieStatus } from "@/lib/labels";

const leeg: ActieStatus = {};

/**
 * Declaratie samenstellen: facturen kiezen en per factuur het bedrag dat je
 * bij de bank indient (standaard wat er nog van de factuur kan).
 */
export function DeclaratieFormulier({
  declaratie,
  depot,
  documenten,
  vandaag,
}: {
  declaratie?: {
    id: string;
    nummer: string | null;
    notities: string | null;
    ingediendOp: string | null;
    regels: { documentId: string; bedrag: number }[];
  };
  depot: { id: string; vrij: number };
  documenten: DeclarabelDocument[];
  vandaag: string;
}) {
  const [status, actie, bezig] = useActionState(declaratieOpslaan, leeg);
  const f = status.veldfouten ?? {};
  const basis = useId();
  const [bedragen, setBedragen] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(
      (declaratie?.regels ?? []).map((r) => [r.documentId, r.bedrag]),
    ),
  );
  const gekozen = Object.entries(bedragen);
  const totaal = gekozen.reduce((a, [, b]) => a + (b ?? 0), 0);
  // Bij bewerken telt het eigen bedrag niet als "al gedeclareerd".
  const eigen = (declaratie?.regels ?? []).reduce((a, r) => a + r.bedrag, 0);
  const vrij = depot.vrij + eigen;
  const teVeel = documenten.filter(
    (d) => d.id in bedragen && (bedragen[d.id] ?? 0) > d.max,
  );
  const regels = gekozen
    .filter(([, b]) => b !== null && b > 0)
    .map(([documentId, bedrag]) => ({ documentId, bedrag }));

  function kies(d: DeclarabelDocument, aan: boolean) {
    setBedragen((oud) => {
      const nieuw = { ...oud };
      if (aan) nieuw[d.id] = d.max;
      else delete nieuw[d.id];
      return nieuw;
    });
  }

  return (
    <BlijvendFormulier
      actie={actie}
      bezig={bezig}
      className="space-y-6"
      noValidate
    >
      <input type="hidden" name="id" value={declaratie?.id ?? ""} />
      <input type="hidden" name="depotId" value={depot.id} />
      <input type="hidden" name="regels" value={JSON.stringify(regels)} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Facturen</legend>
        {documenten.length === 0 ? (
          <p className="text-muted text-sm">
            Er zijn geen geboekte facturen of bonnen die nog in een declaratie
            kunnen.
          </p>
        ) : (
          <ul className="border-border divide-border divide-y rounded-xl border">
            {documenten.map((d) => {
              const aan = d.id in bedragen;
              const leegKiesbaar = d.max === 0 && !aan;
              return (
                <li key={d.id} className="px-3.5 py-3">
                  <div className="flex items-start gap-3">
                    <input
                      id={`${basis}-${d.id}`}
                      type="checkbox"
                      checked={aan}
                      disabled={leegKiesbaar}
                      onChange={(e) => kies(d, e.target.checked)}
                      className="accent-accent mt-1 size-4 shrink-0"
                    />
                    <label
                      htmlFor={`${basis}-${d.id}`}
                      className={cn(
                        "min-w-0 flex-1 text-sm",
                        leegKiesbaar && "text-muted",
                      )}
                    >
                      <span className="block font-medium">{d.titel}</span>
                      <span className="text-muted block text-xs">
                        {[
                          formatDatum(d.datum),
                          `totaal ${formatEuro(d.totaal)}`,
                          d.betaald > 0 &&
                            `al betaald ${formatEuro(d.betaald)}`,
                          d.max < d.totaal &&
                            `nog te declareren ${formatEuro(d.max)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </label>
                  </div>
                  {aan && (
                    <div className="mt-2 pl-7 sm:max-w-64">
                      <BedragVeld
                        label={
                          <>
                            Bedrag
                            <span className="sr-only"> voor {d.titel}</span>
                          </>
                        }
                        naam={`bedrag-${d.id}`}
                        defaultValue={bedragen[d.id]}
                        onWaarde={(w) =>
                          setBedragen((oud) => ({ ...oud, [d.id]: w }))
                        }
                        fout={
                          (bedragen[d.id] ?? 0) > d.max
                            ? `Hooguit ${formatEuro(d.max)}.`
                            : undefined
                        }
                        hint={
                          d.betaald > 0
                            ? "Al (deels) zelf betaald: bij uitbetaling gaat dat deel over naar het bouwdepot."
                            : undefined
                        }
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <div className="bg-surface-2/60 flex flex-wrap items-baseline justify-between gap-2 rounded-xl px-4 py-3 text-sm">
        <span>
          Totaal declaratie{" "}
          <strong className="tabular-nums">{formatEuro(totaal)}</strong>
        </span>
        <span
          className={cn(
            "text-xs",
            totaal > vrij ? "text-critical font-medium" : "text-muted",
          )}
        >
          Daarna nog vrij in het bouwdepot: {formatEuro(vrij - totaal)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Veld
          label="Nummer van de declaratie (optioneel)"
          naam="nummer"
          autoComplete="off"
          defaultValue={declaratie?.nummer ?? ""}
          fout={f.nummer}
        />
        <DatumVeld
          label="Ingediend op"
          naam="ingediendOp"
          defaultValue={declaratie?.ingediendOp ?? vandaag}
          fout={f.ingediendOp}
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor={`${basis}-notities`}
          className="block text-sm font-medium"
        >
          Notities (optioneel)
        </label>
        <textarea
          id={`${basis}-notities`}
          name="notities"
          rows={2}
          maxLength={2000}
          defaultValue={declaratie?.notities ?? ""}
          className={tekstvakKlassen}
        />
      </div>

      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <div className="flex flex-wrap items-center gap-3">
        <VerzendKnop
          name="actie"
          value="indienen"
          bezigTekst="Opslaan…"
          disabled={!regels.length || teVeel.length > 0}
        >
          <Send className="size-4" />
          Ingediend bij de bank
        </VerzendKnop>
        <VerzendKnop
          name="actie"
          value="concept"
          variant="secundair"
          bezigTekst="Opslaan…"
          disabled={!regels.length || teVeel.length > 0}
        >
          Opslaan als concept
        </VerzendKnop>
        <p className="text-muted text-xs">
          Een declaratie telt pas als betaald als de bank heeft uitbetaald.
        </p>
      </div>
    </BlijvendFormulier>
  );
}

/** Status van een declaratie wijzigen: indienen, afwijzen, heropenen. */
function StatusKnop({
  id,
  status,
  children,
  actie,
  variant = "secundair",
  metDatum,
  datumFout,
  vandaag,
}: {
  id: string;
  status: "concept" | "ingediend" | "afgewezen";
  children: React.ReactNode;
  actie: (formData: FormData) => void;
  variant?: "primair" | "secundair" | "gevaar";
  metDatum?: boolean;
  datumFout?: string;
  vandaag: string;
}) {
  return (
    <form action={actie} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      {metDatum && (
        <DatumVeld
          label="Ingediend op"
          naam="datum"
          defaultValue={vandaag}
          fout={datumFout}
        />
      )}
      <VerzendKnop variant={variant} bezigTekst="Bezig…">
        {children}
      </VerzendKnop>
    </form>
  );
}

/**
 * Acties op een declaratie. De meldingen staan hier (en niet bij de knop),
 * omdat de knoppen na een statuswissel verdwijnen.
 */
export function DeclaratieActies({
  id,
  status,
  vandaag,
}: {
  id: string;
  status: DeclaratieStatus;
  vandaag: string;
}) {
  const [st, statusActie] = useActionState(declaratieStatus, leeg);
  const [uit, uitbetalen] = useActionState(declaratieUitbetalen, leeg);
  const [weg, verwijderen] = useActionState(declaratieVerwijderen, leeg);
  const meldingen = [st, uit].map((s, i) =>
    s.fout ? (
      <Melding key={`fout-${i}`} soort="fout">
        {s.fout}
      </Melding>
    ) : s.succes ? (
      <Melding key={`succes-${i}`} soort="succes">
        {s.succes}
      </Melding>
    ) : null,
  );

  if (status === "uitbetaald") {
    return (
      <div className="space-y-3">
        {meldingen}
        <p className="text-muted text-sm">
          De betalingen uit het bouwdepot staan bij de facturen; een uitbetaalde
          declaratie ligt vast.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {meldingen}
      {status === "ingediend" && (
        <form action={uitbetalen} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <p className="text-muted text-sm leading-relaxed">
            Heeft de bank uitbetaald? Dan legt de app bij elke factuur de
            betaling uit het bouwdepot vast. Wat je al zelf had betaald, gaat
            over naar het bouwdepot.
          </p>
          <div className="sm:max-w-64">
            <DatumVeld
              label="Uitbetaald op"
              naam="datum"
              defaultValue={vandaag}
              fout={uit.veldfouten?.datum}
            />
          </div>
          <VerzendKnop bezigTekst="Vastleggen…">
            <BadgeCheck className="size-4" />
            Uitbetaald door de bank
          </VerzendKnop>
        </form>
      )}

      <div className="flex flex-wrap items-start gap-3">
        {status === "concept" && (
          <StatusKnop
            id={id}
            status="ingediend"
            actie={statusActie}
            variant="primair"
            metDatum
            datumFout={st.veldfouten?.datum}
            vandaag={vandaag}
          >
            <Send className="size-4" />
            Ingediend bij de bank
          </StatusKnop>
        )}
        {status === "ingediend" && (
          <>
            <StatusKnop
              id={id}
              status="afgewezen"
              actie={statusActie}
              vandaag={vandaag}
            >
              <CircleX className="size-4" />
              Afgewezen door de bank
            </StatusKnop>
            <StatusKnop
              id={id}
              status="concept"
              actie={statusActie}
              vandaag={vandaag}
            >
              <RotateCcw className="size-4" />
              Terug naar concept
            </StatusKnop>
          </>
        )}
        {status === "afgewezen" && (
          <StatusKnop
            id={id}
            status="concept"
            actie={statusActie}
            vandaag={vandaag}
          >
            <RotateCcw className="size-4" />
            Opnieuw openen
          </StatusKnop>
        )}
      </div>

      {status !== "ingediend" && (
        <form action={verwijderen} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="bevestig"
              value="ja"
              className="accent-accent mt-0.5 size-4 shrink-0"
            />
            Ja, verwijder deze declaratie.
          </label>
          {weg.fout && <Melding soort="fout">{weg.fout}</Melding>}
          <VerzendKnop variant="gevaar" bezigTekst="Verwijderen…">
            <Trash2 className="size-4" />
            Declaratie verwijderen
          </VerzendKnop>
        </form>
      )}
    </div>
  );
}
