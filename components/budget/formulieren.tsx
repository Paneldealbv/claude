"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useState } from "react";
import { BedragVeld } from "@/components/ui/bedrag-veld";
import { Melding, Veld, VerzendKnop } from "@/components/ui/form";
import { knopKlassen } from "@/components/ui/knop";
import {
  budgetRegelOpslaan,
  budgetRegelVerwijderen,
  categorieAfsluiten,
  categorieHernoemen,
  categorieToevoegen,
  categorieVerwijderen,
} from "@/lib/acties/budget";
import type { ActieStatus } from "@/lib/acties/project";
import { BTW_TARIEVEN } from "@/lib/btw";
import { formatEuro } from "@/lib/format";

const leeg: ActieStatus = {};

// -----------------------------------------------------------------------------
export function CategorieToevoegenFormulier({
  parentId,
  label,
  knop,
}: {
  parentId: string | null;
  label: string;
  knop: string;
}) {
  const [status, actie] = useActionState(categorieToevoegen, leeg);
  return (
    <form action={actie} className="space-y-3" noValidate>
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Veld
          label={label}
          naam="naam"
          className="flex-1"
          autoComplete="off"
          defaultValue={status.succes ? "" : status.waarden?.naam}
          key={status.succes ?? "invoer"}
          fout={status.veldfouten?.naam}
        />
        <VerzendKnop variant="secundair" bezigTekst="Toevoegen…">
          <Plus className="size-4" />
          {knop}
        </VerzendKnop>
      </div>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
    </form>
  );
}

// -----------------------------------------------------------------------------
export type BudgetRegelWeergave = {
  id: string;
  omschrijving: string;
  bedrag: number;
  btw: number;
};

function BudgetRegelFormulier({
  categorieId,
  regel,
  onKlaar,
}: {
  categorieId: string;
  regel?: BudgetRegelWeergave;
  onKlaar?: () => void;
}) {
  // Na opslaan het formulier leegmaken door het opnieuw op te bouwen.
  const [versie, setVersie] = useState(0);
  const [status, actie] = useActionState(
    async (vorige: ActieStatus, fd: FormData) => {
      const uit = await budgetRegelOpslaan(vorige, fd);
      if (uit.succes) {
        setVersie((v) => v + 1);
        onKlaar?.();
      }
      return uit;
    },
    leeg,
  );
  return (
    <form
      action={actie}
      className="grid gap-3 sm:grid-cols-[1fr_10rem_6.5rem_auto] sm:items-end"
      noValidate
      key={versie}
    >
      <input type="hidden" name="categorieId" value={categorieId} />
      <input type="hidden" name="id" value={regel?.id ?? ""} />
      <Veld
        label="Omschrijving"
        naam="omschrijving"
        placeholder="Bijv. keukenkasten"
        autoComplete="off"
        defaultValue={status.waarden?.omschrijving ?? regel?.omschrijving}
        fout={status.veldfouten?.omschrijving}
      />
      <BedragVeld
        label="Bedrag incl. BTW"
        naam="bedrag"
        defaultValue={regel?.bedrag ?? null}
        fout={status.veldfouten?.bedrag}
      />
      <div className="space-y-1.5">
        <label
          htmlFor={`btw-${regel?.id ?? "nieuw"}`}
          className="block text-sm font-medium"
        >
          BTW
        </label>
        <select
          id={`btw-${regel?.id ?? "nieuw"}`}
          name="btw"
          defaultValue={regel?.btw ?? 2100}
          className="border-border-strong bg-surface focus:border-accent focus:ring-accent/15 block w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none focus:ring-4"
        >
          {BTW_TARIEVEN.map((t) => (
            <option key={t.bp} value={t.bp}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <VerzendKnop bezigTekst="Opslaan…">
          {regel ? "Opslaan" : "Toevoegen"}
        </VerzendKnop>
        {onKlaar && regel && (
          <button
            type="button"
            onClick={onKlaar}
            className={knopKlassen("stil", "px-3")}
          >
            <X className="size-4" />
            <span className="sr-only">Annuleren</span>
          </button>
        )}
      </div>
      {status.fout && (
        <div className="sm:col-span-4">
          <Melding soort="fout">{status.fout}</Melding>
        </div>
      )}
    </form>
  );
}

/** Budgetregels van een categorie, met toevoegen, wijzigen en verwijderen. */
export function BudgetRegels({
  categorieId,
  regels,
  magBewerken,
}: {
  categorieId: string;
  regels: BudgetRegelWeergave[];
  magBewerken: boolean;
}) {
  const [bewerken, setBewerken] = useState<string | null>(null);
  const totaal = regels.reduce((a, r) => a + r.bedrag, 0);
  const tarief = (bp: number) =>
    BTW_TARIEVEN.find((t) => t.bp === bp)?.label ?? "";

  return (
    <div>
      {regels.length > 0 ? (
        <ul>
          {regels.map((r) =>
            bewerken === r.id ? (
              <li
                key={r.id}
                className="border-border bg-surface-2/60 border-t px-5 py-4 sm:px-6"
              >
                <BudgetRegelFormulier
                  categorieId={categorieId}
                  regel={r}
                  onKlaar={() => setBewerken(null)}
                />
              </li>
            ) : (
              <li
                key={r.id}
                className="border-border flex items-center gap-3 border-t px-5 py-3 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {r.omschrijving || "Budget"}
                  </p>
                  <p className="text-muted text-xs">{tarief(r.btw)} BTW</p>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {formatEuro(r.bedrag, { centen: false })}
                </span>
                {magBewerken && (
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => setBewerken(r.id)}
                      className={knopKlassen("stil", "px-2 py-1.5")}
                      title="Wijzigen"
                    >
                      <Pencil className="size-4" />
                      <span className="sr-only">
                        Wijzig {r.omschrijving || "budgetregel"}
                      </span>
                    </button>
                    <form action={budgetRegelVerwijderen}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className={knopKlassen(
                          "stil",
                          "hover:text-critical px-2 py-1.5",
                        )}
                        title="Verwijderen"
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">
                          Verwijder {r.omschrijving || "budgetregel"}
                        </span>
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ),
          )}
          <li className="border-border flex items-center justify-between border-t px-5 py-3 text-sm font-semibold tabular-nums sm:px-6">
            <span>Totaal budget</span>
            <span>{formatEuro(totaal, { centen: false })}</span>
          </li>
        </ul>
      ) : (
        <p className="text-muted border-border border-t px-5 py-4 text-sm sm:px-6">
          Nog geen budget voor deze categorie.
        </p>
      )}
      {magBewerken && (
        <div className="border-border border-t px-5 py-4 sm:px-6">
          <p className="mb-3 text-sm font-medium">Budgetregel toevoegen</p>
          <BudgetRegelFormulier categorieId={categorieId} />
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
export function HernoemFormulier({ id, naam }: { id: string; naam: string }) {
  const [status, actie] = useActionState(categorieHernoemen, leeg);
  return (
    <form action={actie} className="space-y-3" noValidate>
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Veld
          label="Naam"
          naam="naam"
          className="flex-1"
          defaultValue={naam}
          fout={status.veldfouten?.naam}
        />
        <VerzendKnop variant="secundair" bezigTekst="Opslaan…">
          Opslaan
        </VerzendKnop>
      </div>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && <Melding soort="succes">{status.succes}</Melding>}
    </form>
  );
}

export function AfsluitFormulier({
  id,
  metWaarschuwingen,
}: {
  id: string;
  metWaarschuwingen: boolean;
}) {
  const [status, actie] = useActionState(categorieAfsluiten, leeg);
  return (
    <form action={actie} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {metWaarschuwingen && (
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="bevestig"
            value="ja"
            className="accent-accent mt-0.5 size-4 shrink-0"
          />
          Ik heb de waarschuwingen gelezen en wil de categorie toch afsluiten.
        </label>
      )}
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <VerzendKnop bezigTekst="Afsluiten…">Categorie afsluiten</VerzendKnop>
    </form>
  );
}

export function VerwijderFormulier({ id, naam }: { id: string; naam: string }) {
  const [status, actie] = useActionState(categorieVerwijderen, leeg);
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
        Ja, verwijder &quot;{naam}&quot; met de budgetregels.
      </label>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <VerzendKnop variant="gevaar" bezigTekst="Verwijderen…">
        <Trash2 className="size-4" />
        Categorie verwijderen
      </VerzendKnop>
    </form>
  );
}
