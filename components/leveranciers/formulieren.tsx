"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import { Melding, Veld, VerzendKnop } from "@/components/ui/form";
import {
  leverancierOpslaan,
  leverancierVerwijderen,
} from "@/lib/acties/leveranciers";
import type { ActieStatus } from "@/lib/acties/project";
import type { Leverancier } from "@/lib/data/offertes";

const leeg: ActieStatus = {};

export function LeverancierFormulier({
  leverancier,
  magBewerken = true,
}: {
  leverancier?: Leverancier;
  magBewerken?: boolean;
}) {
  const [status, actie] = useActionState(leverancierOpslaan, leeg);
  const w = (veld: string, standaard?: string | null) =>
    status.waarden?.[veld] ?? standaard ?? "";
  const f = status.veldfouten ?? {};
  return (
    <form action={actie} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={leverancier?.id ?? ""} />
      <fieldset
        disabled={!magBewerken}
        className="grid gap-4 disabled:opacity-80 sm:grid-cols-2"
      >
        <Veld
          className="sm:col-span-2"
          label="Naam"
          naam="naam"
          autoComplete="organization"
          defaultValue={w("naam", leverancier?.naam)}
          fout={f.naam}
        />
        <Veld
          label="Contactpersoon"
          naam="contactpersoon"
          autoComplete="name"
          defaultValue={w("contactpersoon", leverancier?.contactpersoon)}
          fout={f.contactpersoon}
        />
        <Veld
          label="Telefoon"
          naam="telefoon"
          type="tel"
          autoComplete="tel"
          defaultValue={w("telefoon", leverancier?.telefoon)}
          fout={f.telefoon}
        />
        <Veld
          className="sm:col-span-2"
          label="E-mailadres"
          naam="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={w("email", leverancier?.email)}
          fout={f.email}
        />
        <Veld
          label="IBAN"
          naam="iban"
          autoComplete="off"
          placeholder="NL00 BANK 0123 4567 89"
          defaultValue={w("iban", leverancier?.iban)}
          fout={f.iban}
        />
        <Veld
          label="KvK-nummer"
          naam="kvk"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={w("kvk", leverancier?.kvk)}
          fout={f.kvk}
        />
        <Veld
          label="BTW-nummer"
          naam="btwNummer"
          autoComplete="off"
          defaultValue={w("btwNummer", leverancier?.btwNummer)}
          fout={f.btwNummer}
        />
        <div className="space-y-1.5 sm:col-span-2">
          <label
            htmlFor="leverancier-notities"
            className="block text-sm font-medium"
          >
            Notities
          </label>
          <textarea
            id="leverancier-notities"
            name="notities"
            rows={3}
            maxLength={2000}
            defaultValue={w("notities", leverancier?.notities)}
            className="border-border-strong bg-surface focus:border-accent focus:ring-accent/15 block w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none focus:ring-4"
          />
        </div>
      </fieldset>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && <Melding soort="succes">{status.succes}</Melding>}
      {magBewerken && (
        <VerzendKnop bezigTekst="Opslaan…">
          {leverancier ? "Opslaan" : "Leverancier toevoegen"}
        </VerzendKnop>
      )}
    </form>
  );
}

export function LeverancierVerwijderen({
  id,
  naam,
}: {
  id: string;
  naam: string;
}) {
  const [status, actie] = useActionState(leverancierVerwijderen, leeg);
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
        Ja, verwijder &quot;{naam}&quot;.
      </label>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <VerzendKnop variant="gevaar" bezigTekst="Verwijderen…">
        <Trash2 className="size-4" />
        Leverancier verwijderen
      </VerzendKnop>
    </form>
  );
}
