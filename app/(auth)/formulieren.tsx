"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Melding, Veld, VerzendKnop } from "@/components/ui/form";
import {
  inloggen,
  registreren,
  wachtwoordHerstellen,
  wachtwoordVergeten,
  type FormStatus,
} from "./acties";

const leeg: FormStatus = {};

export function InlogFormulier({
  volgende,
  melding,
}: {
  volgende?: string;
  melding?: { soort: "fout" | "succes"; tekst: string };
}) {
  const [status, actie] = useActionState(inloggen, leeg);
  return (
    <form action={actie} className="space-y-5" noValidate>
      {status.fout ? (
        <Melding soort="fout">{status.fout}</Melding>
      ) : (
        melding && <Melding soort={melding.soort}>{melding.tekst}</Melding>
      )}
      <input type="hidden" name="volgende" value={volgende ?? ""} />
      <Veld
        label="E-mailadres"
        naam="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={status.waarden?.email}
        fout={status.veldfouten?.email}
      />
      <div className="space-y-1.5">
        <Veld
          label="Wachtwoord"
          naam="wachtwoord"
          type="password"
          autoComplete="current-password"
          required
          fout={status.veldfouten?.wachtwoord}
        />
        <div className="text-right">
          <Link
            href="/wachtwoord-vergeten"
            className="text-accent-ink text-xs font-medium hover:underline"
          >
            Wachtwoord vergeten?
          </Link>
        </div>
      </div>
      <VerzendKnop className="w-full" bezigTekst="Bezig met inloggen…">
        Inloggen
      </VerzendKnop>
    </form>
  );
}

export function RegistratieFormulier({
  volgende,
  email,
}: {
  volgende?: string;
  email?: string;
}) {
  const [status, actie] = useActionState(registreren, leeg);
  if (status.succes) {
    return (
      <div className="space-y-4">
        <Melding soort="succes">{status.succes}</Melding>
        <p className="text-muted text-sm">
          Geen mail ontvangen? Kijk ook in je map met ongewenste mail.
        </p>
      </div>
    );
  }
  return (
    <form action={actie} className="space-y-5" noValidate>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <input type="hidden" name="volgende" value={volgende ?? ""} />
      <Veld
        label="Naam"
        naam="naam"
        autoComplete="name"
        required
        defaultValue={status.waarden?.naam}
        fout={status.veldfouten?.naam}
      />
      <Veld
        label="E-mailadres"
        naam="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={status.waarden?.email ?? email}
        fout={status.veldfouten?.email}
        hint={
          email ? "Gebruik het adres waarop je bent uitgenodigd." : undefined
        }
      />
      <Veld
        label="Wachtwoord"
        naam="wachtwoord"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        fout={status.veldfouten?.wachtwoord}
        hint="Minimaal 10 tekens."
      />
      <Veld
        label="Herhaal wachtwoord"
        naam="herhaal"
        type="password"
        autoComplete="new-password"
        required
        fout={status.veldfouten?.herhaal}
      />
      <VerzendKnop className="w-full" bezigTekst="Account aanmaken…">
        Account aanmaken
      </VerzendKnop>
    </form>
  );
}

export function WachtwoordVergetenFormulier() {
  const [status, actie] = useActionState(wachtwoordVergeten, leeg);
  if (status.succes) return <Melding soort="succes">{status.succes}</Melding>;
  return (
    <form action={actie} className="space-y-5" noValidate>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <Veld
        label="E-mailadres"
        naam="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={status.waarden?.email}
        fout={status.veldfouten?.email}
      />
      <VerzendKnop className="w-full" bezigTekst="Versturen…">
        Stuur herstellink
      </VerzendKnop>
    </form>
  );
}

export function WachtwoordHerstellenFormulier() {
  const [status, actie] = useActionState(wachtwoordHerstellen, leeg);
  if (status.succes) {
    return (
      <div className="space-y-4">
        <Melding soort="succes">{status.succes}</Melding>
        <Link href="/dashboard" className="text-accent-ink text-sm font-medium">
          Naar het dashboard →
        </Link>
      </div>
    );
  }
  return (
    <form action={actie} className="space-y-5" noValidate>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <Veld
        label="Nieuw wachtwoord"
        naam="wachtwoord"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        fout={status.veldfouten?.wachtwoord}
        hint="Minimaal 10 tekens."
      />
      <Veld
        label="Herhaal nieuw wachtwoord"
        naam="herhaal"
        type="password"
        autoComplete="new-password"
        required
        fout={status.veldfouten?.herhaal}
      />
      <VerzendKnop className="w-full" bezigTekst="Opslaan…">
        Wachtwoord opslaan
      </VerzendKnop>
    </form>
  );
}
