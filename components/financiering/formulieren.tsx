"use client";

import { Link2, Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { keuzeKlassen } from "@/components/invoer/keuzes";
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
  betalingenBronToewijzen,
  bronOpslaan,
  bronVerwijderen,
} from "@/lib/acties/financiering";
import type { ActieStatus } from "@/lib/acties/project";
import { cn } from "@/lib/cn";
import { formatDatum, formatEuro } from "@/lib/format";
import { BRON_TYPE, HOOFDBRONNEN, type HoofdbronSoort } from "@/lib/labels";

const leeg: ActieStatus = {};

export type BronInvoer = {
  id?: string;
  type: HoofdbronSoort;
  naam: string;
  verstrekker: string | null;
  bedrag: number | null;
  renteBp: number | null;
  start: string | null;
  eind: string | null;
  notities: string | null;
  bouwdepot: number | null;
  depotEind: string | null;
};

const UITLEG: Record<HoofdbronSoort, string> = {
  eigen_geld: "Spaargeld of overwaarde die je zelf inbrengt.",
  hypotheek:
    "Het totale leenbedrag. Een bouwdepot is een deel daarvan, geen extra geld.",
  schenking: "Bijvoorbeeld een schenking van ouders.",
  lening: "Een andere lening, bijvoorbeeld van familie.",
  overig: "Alle andere bronnen.",
};

/** Bron toevoegen of wijzigen; bij een hypotheek ook het bouwdepot. */
export function BronFormulier({ bron }: { bron: BronInvoer }) {
  const [status, actie, bezig] = useActionState(bronOpslaan, leeg);
  const f = status.veldfouten ?? {};
  const basis = useId();
  const nieuw = !bron.id;
  const [type, setType] = useState<HoofdbronSoort>(bron.type);
  const [naam, setNaam] = useState(bron.naam);
  const [naamZelf, setNaamZelf] = useState(!nieuw);
  const [bedrag, setBedrag] = useState<number | null>(bron.bedrag);
  const [depot, setDepot] = useState<number | null>(bron.bouwdepot);
  const metRente = type === "hypotheek" || type === "lening";
  const overig = bedrag !== null && depot ? bedrag - depot : null;

  function kiesType(t: HoofdbronSoort) {
    setType(t);
    // Zolang de naam niet zelf is aangepast, volgt hij het soort.
    if (!naamZelf) setNaam(BRON_TYPE[t].tekst);
  }

  return (
    <BlijvendFormulier
      actie={actie}
      bezig={bezig}
      className="space-y-6"
      noValidate
    >
      <input type="hidden" name="id" value={bron.id ?? ""} />
      {nieuw ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Soort bron</legend>
          <div className="flex flex-wrap gap-2">
            {HOOFDBRONNEN.map((t) => (
              <label
                key={t}
                htmlFor={`${basis}-${t}`}
                className={cn(
                  "border-border-strong cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                  type === t
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "text-muted hover:text-foreground",
                )}
              >
                <input
                  id={`${basis}-${t}`}
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => kiesType(t)}
                  className="sr-only"
                />
                {BRON_TYPE[t].tekst}
              </label>
            ))}
          </div>
          <p className="text-muted mt-2 text-xs">{UITLEG[type]}</p>
        </fieldset>
      ) : (
        <input type="hidden" name="type" value={type} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Veld
          label="Naam"
          naam="naam"
          value={naam}
          onChange={(e) => {
            setNaam(e.target.value);
            setNaamZelf(true);
          }}
          autoComplete="off"
          fout={f.naam}
        />
        <Veld
          label={
            type === "hypotheek"
              ? "Geldverstrekker (optioneel)"
              : "Van wie (optioneel)"
          }
          naam="verstrekker"
          defaultValue={bron.verstrekker ?? ""}
          autoComplete="off"
          fout={f.verstrekker}
        />
        <BedragVeld
          label={type === "hypotheek" ? "Hypotheekbedrag" : "Bedrag"}
          naam="bedrag"
          defaultValue={bron.bedrag}
          onWaarde={setBedrag}
          fout={f.bedrag}
        />
        {metRente && (
          <Veld
            label="Rente in % (optioneel)"
            naam="rente"
            inputMode="decimal"
            autoComplete="off"
            placeholder="3,85"
            defaultValue={
              bron.renteBp !== null
                ? (bron.renteBp / 100).toLocaleString("nl-NL", {
                    maximumFractionDigits: 2,
                  })
                : ""
            }
            fout={f.rente}
          />
        )}
        {metRente && (
          <>
            <DatumVeld
              label="Ingangsdatum (optioneel)"
              naam="start"
              defaultValue={bron.start}
              fout={f.start}
            />
            <DatumVeld
              label="Einddatum (optioneel)"
              naam="eind"
              defaultValue={bron.eind}
              fout={f.eind}
            />
          </>
        )}
      </div>

      {type === "hypotheek" && (
        <fieldset className="border-border space-y-3 rounded-2xl border p-4 sm:p-5">
          <legend className="px-1 text-sm font-medium">Bouwdepot</legend>
          <p className="text-muted text-xs leading-relaxed">
            Het bouwdepot is een deel van de hypotheek: de bank houdt het geld
            vast en betaalt de bouwfacturen daaruit. Het telt niet extra mee.
            Wat overblijft is de overige hypotheekruimte.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <BedragVeld
              label="Bedrag in het bouwdepot (optioneel)"
              naam="bouwdepot"
              defaultValue={bron.bouwdepot}
              onWaarde={setDepot}
              fout={f.bouwdepot}
            />
            <DatumVeld
              label="Bouwdepot loopt tot (optioneel)"
              naam="depotEind"
              defaultValue={bron.depotEind}
              fout={f.depotEind}
            />
          </div>
          {overig !== null && (
            <p
              className={cn(
                "text-sm",
                overig < 0 ? "text-critical font-medium" : "text-muted",
              )}
              aria-live="polite"
            >
              {overig < 0
                ? "Het bouwdepot is hoger dan het hypotheekbedrag."
                : `Overige hypotheekruimte: ${formatEuro(overig)}`}
            </p>
          )}
        </fieldset>
      )}

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
          defaultValue={bron.notities ?? ""}
          className={tekstvakKlassen}
        />
      </div>

      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <VerzendKnop bezigTekst="Opslaan…">
        {nieuw ? "Bron toevoegen" : "Wijzigingen opslaan"}
      </VerzendKnop>
    </BlijvendFormulier>
  );
}

export function BronVerwijderen({
  id,
  heeftBetalingen,
}: {
  id: string;
  heeftBetalingen: boolean;
}) {
  const [status, actie] = useActionState(bronVerwijderen, leeg);
  return (
    <form action={actie} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-muted text-sm">
        {heeftBetalingen
          ? "De betalingen uit deze bron blijven bestaan, maar zonder bron. "
          : ""}
        Een hypotheek gaat samen met zijn bouwdepot weg.
      </p>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="bevestig"
          value="ja"
          className="accent-accent mt-0.5 size-4 shrink-0"
        />
        Ja, verwijder deze bron.
      </label>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <VerzendKnop variant="gevaar" bezigTekst="Verwijderen…">
        <Trash2 className="size-4" />
        Bron verwijderen
      </VerzendKnop>
    </form>
  );
}

/** Betalingen die nog geen bron hebben in één keer koppelen. */
export function BetalingenZonderBron({
  betalingen,
  bronnen,
}: {
  betalingen: {
    id: string;
    titel: string;
    datum: string;
    bedrag: number;
  }[];
  bronnen: { id: string; naam: string }[];
}) {
  const [status, actie, bezig] = useActionState(betalingenBronToewijzen, leeg);
  const id = useId();
  return (
    <BlijvendFormulier actie={actie} bezig={bezig} className="space-y-4">
      <ul className="border-border divide-border divide-y rounded-xl border">
        {betalingen.map((b) => (
          <li key={b.id}>
            <label className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
              <input
                type="checkbox"
                name="betaling"
                value={b.id}
                defaultChecked
                className="accent-accent size-4 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{b.titel}</span>
                <span className="text-muted text-xs">
                  Betaald op {formatDatum(b.datum)}
                </span>
              </span>
              <span className="font-medium tabular-nums">
                {formatEuro(b.bedrag)}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1.5">
          <label htmlFor={id} className="block text-sm font-medium">
            Betaald uit
          </label>
          <select id={id} name="bronId" className={keuzeKlassen}>
            {bronnen.map((b) => (
              <option key={b.id} value={b.id}>
                {b.naam}
              </option>
            ))}
          </select>
        </div>
        <VerzendKnop bezigTekst="Koppelen…">
          <Link2 className="size-4" />
          Gekozen betalingen koppelen
        </VerzendKnop>
      </div>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && <Melding soort="succes">{status.succes}</Melding>}
    </BlijvendFormulier>
  );
}
