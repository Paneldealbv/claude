"use client";

import { FileCheck2, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { BestandUpload } from "@/components/invoer/bestand-upload";
import { LeverancierKeuze } from "@/components/invoer/leverancier-keuze";
import {
  RegelsEditor,
  type CategorieOptie,
  type RegelInvoer,
} from "@/components/invoer/regels-editor";
import { DatumVeld } from "@/components/ui/datum-veld";
import {
  BlijvendFormulier,
  Melding,
  Veld,
  VerzendKnop,
} from "@/components/ui/form";
import {
  offerteAccepteren,
  offerteOpslaan,
  offerteVerwijderen,
} from "@/lib/acties/offertes";
import type { ActieStatus } from "@/lib/acties/project";

const leeg: ActieStatus = {};

export const tekstvakKlassen =
  "border-border-strong bg-surface placeholder:text-subtle focus:border-accent focus:ring-accent/15 block w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none focus:ring-4";

export type OfferteInvoer = {
  id: string;
  titel: string;
  nummer: string | null;
  datum: string | null;
  geldigTot: string | null;
  leverancierId: string | null;
  notities: string | null;
  regels: RegelInvoer[];
};

export type BestandKeuze = {
  id: string;
  naam: string;
  grootte?: number;
  type?: string;
};

/** Nieuwe offerte invoeren of een bestaande wijzigen. */
export function OfferteFormulier({
  offerte,
  bestand,
  leveranciers,
  categorieen,
  standaardLeverancier,
}: {
  offerte?: OfferteInvoer;
  bestand?: BestandKeuze | null;
  leveranciers: { id: string; naam: string }[];
  categorieen: CategorieOptie[];
  /** Bij een nieuwe offerte vanaf de pagina van een leverancier. */
  standaardLeverancier?: string;
}) {
  const [status, actie, bezig] = useActionState(offerteOpslaan, leeg);
  const f = status.veldfouten ?? {};
  return (
    <BlijvendFormulier
      actie={actie}
      bezig={bezig}
      className="space-y-6"
      noValidate
    >
      <input type="hidden" name="id" value={offerte?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <LeverancierKeuze
            leveranciers={leveranciers}
            standaard={offerte ? offerte.leverancierId : standaardLeverancier}
            fout={f.nieuweLeverancier}
          />
        </div>
        <Veld
          className="sm:col-span-2"
          label="Titel"
          naam="titel"
          autoComplete="off"
          placeholder="Bijv. keuken met apparatuur"
          defaultValue={offerte?.titel}
          fout={f.titel}
        />
        <Veld
          label="Offertenummer (optioneel)"
          naam="nummer"
          autoComplete="off"
          defaultValue={offerte?.nummer ?? ""}
          fout={f.nummer}
        />
        <DatumVeld
          label="Offertedatum (optioneel)"
          naam="datum"
          defaultValue={offerte?.datum}
          fout={f.datum}
        />
        <DatumVeld
          label="Geldig tot (optioneel)"
          naam="geldigTot"
          defaultValue={offerte?.geldigTot}
          fout={f.geldigTot}
        />
        <div className="sm:col-span-2">
          <BestandUpload label="Offerte (PDF of foto)" standaard={bestand} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Regels</legend>
        <p className="text-muted text-xs leading-relaxed">
          Neem de posten van de offerte over, inclusief BTW. Een categorie is
          nodig om de offerte later te accepteren; zo weet het dashboard waar
          het bedrag meetelt.
        </p>
        <div className="pt-1">
          <RegelsEditor categorieen={categorieen} standaard={offerte?.regels} />
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="offerte-notities" className="block text-sm font-medium">
          Notities (optioneel)
        </label>
        <textarea
          id="offerte-notities"
          name="notities"
          rows={3}
          maxLength={2000}
          defaultValue={offerte?.notities ?? ""}
          className={tekstvakKlassen}
        />
        {f.notities && (
          <p className="text-critical text-xs font-medium">{f.notities}</p>
        )}
      </div>

      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <VerzendKnop bezigTekst="Opslaan…">
        {offerte ? "Wijzigingen opslaan" : "Offerte opslaan"}
      </VerzendKnop>
    </BlijvendFormulier>
  );
}

/** Offerte accepteren: maakt een contract met dezelfde regels. */
export function OfferteAccepteren({
  id,
  titel,
}: {
  id: string;
  titel: string;
}) {
  const [status, actie] = useActionState(offerteAccepteren, leeg);
  const f = status.veldfouten ?? {};
  return (
    <form action={actie} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <Veld
        label="Naam van het contract"
        naam="titel"
        autoComplete="off"
        defaultValue={titel}
        fout={f.titel}
      />
      <DatumVeld
        label="Getekend op (optioneel)"
        naam="getekendOp"
        fout={f.getekendOp}
      />
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <VerzendKnop bezigTekst="Contract maken…">
        <FileCheck2 className="size-4" />
        Accepteren en contract maken
      </VerzendKnop>
    </form>
  );
}

export function OfferteVerwijderen({
  id,
  titel,
}: {
  id: string;
  titel: string;
}) {
  const [status, actie] = useActionState(offerteVerwijderen, leeg);
  return (
    <form action={actie} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="bevestig"
          value="ja"
          className="accent-accent mt-0.5 size-4 shrink-0"
        />
        Ja, verwijder &quot;{titel}&quot;.
      </label>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <VerzendKnop variant="gevaar" bezigTekst="Verwijderen…">
        <Trash2 className="size-4" />
        Offerte verwijderen
      </VerzendKnop>
    </form>
  );
}
