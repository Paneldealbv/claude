"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { Melding, Veld, VerzendKnop } from "@/components/ui/form";
import { knopKlassen } from "@/components/ui/knop";
import type { ActieStatus } from "@/lib/acties/project";
import {
  ruimteToevoegen,
  ruimteVerplaatsen,
  ruimteVerwijderen,
  ruimteWijzigen,
} from "@/lib/acties/ruimtes";
import { formatEuro } from "@/lib/format";

const leeg: ActieStatus = {};
const VERDIEPINGEN = [
  "Kelder",
  "Begane grond",
  "Eerste verdieping",
  "Tweede verdieping",
  "Buiten",
];

export type RuimteWeergave = {
  id: string;
  naam: string;
  verdieping: string | null;
  vastgelegd: number;
};

function VerdiepingVeld({ defaultValue }: { defaultValue?: string | null }) {
  const lijstId = useId();
  return (
    <>
      <Veld
        label="Verdieping (optioneel)"
        naam="verdieping"
        list={lijstId}
        autoComplete="off"
        defaultValue={defaultValue ?? ""}
      />
      <datalist id={lijstId}>
        {VERDIEPINGEN.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </>
  );
}

export function RuimteToevoegen() {
  const [versie, setVersie] = useState(0);
  const [status, actie] = useActionState(
    async (v: ActieStatus, fd: FormData) => {
      const uit = await ruimteToevoegen(v, fd);
      if (uit.succes) setVersie((x) => x + 1);
      return uit;
    },
    leeg,
  );
  return (
    <form
      key={versie}
      action={actie}
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      noValidate
    >
      <Veld
        label="Naam"
        naam="naam"
        autoComplete="off"
        placeholder="Bijv. Werkkamer"
        defaultValue={status.waarden?.naam}
        fout={status.veldfouten?.naam}
      />
      <VerdiepingVeld defaultValue={status.waarden?.verdieping} />
      <VerzendKnop variant="secundair" bezigTekst="Toevoegen…">
        <Plus className="size-4" />
        Ruimte toevoegen
      </VerzendKnop>
      {status.fout && (
        <div className="sm:col-span-3">
          <Melding soort="fout">{status.fout}</Melding>
        </div>
      )}
    </form>
  );
}

function RuimteRij({
  ruimte,
  eerste,
  laatste,
  magBewerken,
}: {
  ruimte: RuimteWeergave;
  eerste: boolean;
  laatste: boolean;
  magBewerken: boolean;
}) {
  const [bewerken, setBewerken] = useState(false);
  const [wijzigStatus, wijzig] = useActionState(
    async (v: ActieStatus, fd: FormData) => {
      const uit = await ruimteWijzigen(v, fd);
      if (uit.succes) setBewerken(false);
      return uit;
    },
    leeg,
  );
  const [verwijderStatus, verwijder] = useActionState(ruimteVerwijderen, leeg);

  if (bewerken) {
    return (
      <li className="border-border bg-surface-2/60 border-t px-5 py-4 sm:px-6">
        <form
          action={wijzig}
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          noValidate
        >
          <input type="hidden" name="id" value={ruimte.id} />
          <Veld
            label="Naam"
            naam="naam"
            defaultValue={wijzigStatus.waarden?.naam ?? ruimte.naam}
            fout={wijzigStatus.veldfouten?.naam}
          />
          <VerdiepingVeld
            defaultValue={wijzigStatus.waarden?.verdieping ?? ruimte.verdieping}
          />
          <div className="flex gap-2">
            <VerzendKnop bezigTekst="Opslaan…">Opslaan</VerzendKnop>
            <button
              type="button"
              onClick={() => setBewerken(false)}
              className={knopKlassen("stil", "px-3")}
            >
              <X className="size-4" />
              <span className="sr-only">Annuleren</span>
            </button>
          </div>
          {wijzigStatus.fout && (
            <div className="sm:col-span-3">
              <Melding soort="fout">{wijzigStatus.fout}</Melding>
            </div>
          )}
        </form>
      </li>
    );
  }

  return (
    <li className="border-border border-t px-5 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{ruimte.naam}</p>
          {ruimte.verdieping && (
            <p className="text-muted text-xs">{ruimte.verdieping}</p>
          )}
        </div>
        <span className="text-muted hidden text-xs tabular-nums sm:inline">
          {ruimte.vastgelegd
            ? formatEuro(ruimte.vastgelegd, { centen: false })
            : ""}
        </span>
        {magBewerken && (
          <div className="flex">
            {(["omhoog", "omlaag"] as const).map((richting) => (
              <form key={richting} action={ruimteVerplaatsen}>
                <input type="hidden" name="id" value={ruimte.id} />
                <input type="hidden" name="richting" value={richting} />
                <button
                  type="submit"
                  disabled={richting === "omhoog" ? eerste : laatste}
                  className={knopKlassen("stil", "px-2 py-1.5")}
                  title={richting === "omhoog" ? "Omhoog" : "Omlaag"}
                >
                  {richting === "omhoog" ? (
                    <ArrowUp className="size-4" />
                  ) : (
                    <ArrowDown className="size-4" />
                  )}
                  <span className="sr-only">
                    {ruimte.naam} {richting}
                  </span>
                </button>
              </form>
            ))}
            <button
              type="button"
              onClick={() => setBewerken(true)}
              className={knopKlassen("stil", "px-2 py-1.5")}
              title="Wijzigen"
            >
              <Pencil className="size-4" />
              <span className="sr-only">Wijzig {ruimte.naam}</span>
            </button>
            <form action={verwijder}>
              <input type="hidden" name="id" value={ruimte.id} />
              <button
                type="submit"
                className={knopKlassen(
                  "stil",
                  "hover:text-critical px-2 py-1.5",
                )}
                title="Verwijderen"
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Verwijder {ruimte.naam}</span>
              </button>
            </form>
          </div>
        )}
      </div>
      {verwijderStatus.fout && (
        <div className="mt-2">
          <Melding soort="fout">{verwijderStatus.fout}</Melding>
        </div>
      )}
    </li>
  );
}

export function RuimteLijst({
  ruimtes,
  magBewerken,
}: {
  ruimtes: RuimteWeergave[];
  magBewerken: boolean;
}) {
  return (
    <ul>
      {ruimtes.map((r, i) => (
        <RuimteRij
          key={r.id}
          ruimte={r}
          eerste={i === 0}
          laatste={i === ruimtes.length - 1}
          magBewerken={magBewerken}
        />
      ))}
    </ul>
  );
}
