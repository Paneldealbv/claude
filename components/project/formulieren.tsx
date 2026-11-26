"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useState } from "react";
import { Melding, Veld, VerzendKnop } from "@/components/ui/form";
import {
  profielOpslaan,
  projectAanmaken,
  projectOpslaan,
  uitnodigen,
  uitnodigingAccepteren,
  type ActieStatus,
} from "@/lib/acties/project";

const leeg: ActieStatus = {};

export function ProjectAanmakenFormulier() {
  const [status, actie] = useActionState(projectAanmaken, leeg);
  return (
    <form action={actie} className="space-y-5" noValidate>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <Veld
        label="Naam van het project"
        naam="naam"
        placeholder="Bijv. Kavel 14 · De Nieuwe Erven"
        required
        defaultValue={status.waarden?.naam}
        fout={status.veldfouten?.naam}
      />
      <Veld
        label="Adres (optioneel)"
        naam="adres"
        autoComplete="street-address"
        defaultValue={status.waarden?.adres}
        fout={status.veldfouten?.adres}
      />
      <Veld
        label="Verwachte oplevering (optioneel)"
        naam="oplevering"
        type="date"
        defaultValue={status.waarden?.oplevering}
        fout={status.veldfouten?.oplevering}
      />
      <VerzendKnop className="w-full" bezigTekst="Project aanmaken…">
        Project aanmaken
      </VerzendKnop>
    </form>
  );
}

export function UitnodigingAccepterenFormulier({ token }: { token: string }) {
  const [status, actie] = useActionState(uitnodigingAccepteren, leeg);
  return (
    <form action={actie} className="space-y-4">
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <input type="hidden" name="token" value={token} />
      <VerzendKnop className="w-full" bezigTekst="Bezig…">
        Uitnodiging accepteren
      </VerzendKnop>
    </form>
  );
}

function KopieerLink({ link }: { link: string }) {
  const [gekopieerd, setGekopieerd] = useState(false);
  return (
    <div className="border-border bg-surface-2 flex items-center gap-2 rounded-xl border p-1.5 pl-3">
      <code className="text-muted min-w-0 flex-1 truncate text-xs">{link}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setGekopieerd(true);
            setTimeout(() => setGekopieerd(false), 2500);
          } catch {
            // Klembord niet beschikbaar: link staat zichtbaar om te selecteren.
          }
        }}
        className="bg-surface border-border hover:bg-surface-3 inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium"
      >
        {gekopieerd ? (
          <Check className="text-positive size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {gekopieerd ? "Gekopieerd" : "Kopieer link"}
      </button>
    </div>
  );
}

export function UitnodigenFormulier() {
  const [status, actie] = useActionState(uitnodigen, leeg);
  return (
    <div className="space-y-4">
      <form
        action={actie}
        className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
        noValidate
      >
        <Veld
          label="E-mailadres"
          naam="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          required
          defaultValue={status.link ? "" : status.waarden?.email}
          fout={status.veldfouten?.email}
          key={status.link ?? "invoer"}
        />
        <div className="space-y-1.5">
          <label htmlFor="rol" className="block text-sm font-medium">
            Rol
          </label>
          <select
            id="rol"
            name="rol"
            defaultValue={status.waarden?.rol || "bewerker"}
            className="border-border-strong bg-surface focus:border-accent focus:ring-accent/15 block w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none focus:ring-4"
          >
            <option value="eigenaar">Eigenaar</option>
            <option value="bewerker">Bewerker</option>
            <option value="lezer">Lezer</option>
          </select>
        </div>
        <VerzendKnop bezigTekst="Bezig…">Uitnodigen</VerzendKnop>
      </form>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && status.link && (
        <div className="space-y-2">
          <Melding soort="succes">{status.succes}</Melding>
          <KopieerLink link={status.link} />
        </div>
      )}
    </div>
  );
}

export function ProfielFormulier({ naam }: { naam: string }) {
  const [status, actie] = useActionState(profielOpslaan, leeg);
  return (
    <form action={actie} className="space-y-4" noValidate>
      <Veld
        label="Je naam"
        naam="naam"
        autoComplete="name"
        defaultValue={naam}
        fout={status.veldfouten?.naam}
      />
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && <Melding soort="succes">{status.succes}</Melding>}
      <VerzendKnop variant="secundair" bezigTekst="Opslaan…">
        Opslaan
      </VerzendKnop>
    </form>
  );
}

export function ProjectFormulier({
  naam,
  adres,
  oplevering,
  magWijzigen,
}: {
  naam: string;
  adres: string | null;
  oplevering: string | null;
  magWijzigen: boolean;
}) {
  const [status, actie] = useActionState(projectOpslaan, leeg);
  return (
    <form action={actie} className="space-y-4" noValidate>
      <fieldset
        disabled={!magWijzigen}
        className="space-y-4 disabled:opacity-70"
      >
        <Veld
          label="Naam"
          naam="naam"
          defaultValue={naam}
          fout={status.veldfouten?.naam}
        />
        <Veld
          label="Adres"
          naam="adres"
          defaultValue={adres ?? ""}
          fout={status.veldfouten?.adres}
        />
        <Veld
          label="Verwachte oplevering"
          naam="oplevering"
          type="date"
          defaultValue={oplevering ?? ""}
          fout={status.veldfouten?.oplevering}
        />
      </fieldset>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && <Melding soort="succes">{status.succes}</Melding>}
      {magWijzigen ? (
        <VerzendKnop variant="secundair" bezigTekst="Opslaan…">
          Opslaan
        </VerzendKnop>
      ) : (
        <p className="text-muted text-xs">
          Alleen een eigenaar kan dit wijzigen.
        </p>
      )}
    </form>
  );
}
