"use client";

import { Check, DoorOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { LeverancierKeuze } from "@/components/invoer/leverancier-keuze";
import { BtwKeuze, CategorieKeuze } from "@/components/invoer/keuzes";
import {
  RegelsEditor,
  type CategorieOptie,
} from "@/components/invoer/regels-editor";
import { tekstvakKlassen } from "@/components/offertes/formulieren";
import { BedragVeld } from "@/components/ui/bedrag-veld";
import { DatumVeld } from "@/components/ui/datum-veld";
import {
  BlijvendFormulier,
  Melding,
  useActieMetVersie,
  Veld,
  VerzendKnop,
} from "@/components/ui/form";
import { knopKlassen } from "@/components/ui/knop";
import {
  contractAanmaken,
  contractBijwerken,
  contractRegelOpslaan,
  contractRegelRuimtes,
  contractRegelVerwijderen,
  contractStatusWijzigen,
  contractVerwijderen,
  termijnToevoegen,
  wijzigingToevoegen,
} from "@/lib/acties/contracten";
import type { ActieStatus } from "@/lib/acties/project";
import { cn } from "@/lib/cn";
import { formatEuro } from "@/lib/format";

const leeg: ActieStatus = {};

// -----------------------------------------------------------------------------
// Nieuw contract
// -----------------------------------------------------------------------------

export function ContractFormulier({
  leveranciers,
  categorieen,
  standaardLeverancier,
}: {
  leveranciers: { id: string; naam: string }[];
  categorieen: CategorieOptie[];
  standaardLeverancier?: string;
}) {
  const [status, actie, bezig] = useActionState(contractAanmaken, leeg);
  const f = status.veldfouten ?? {};
  return (
    <BlijvendFormulier
      actie={actie}
      bezig={bezig}
      className="space-y-6"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <LeverancierKeuze
            leveranciers={leveranciers}
            standaard={standaardLeverancier}
            fout={f.nieuweLeverancier}
          />
        </div>
        <Veld
          label="Naam van het contract"
          naam="titel"
          autoComplete="off"
          placeholder="Bijv. aanneemsom ruwbouw"
          fout={f.titel}
        />
        <DatumVeld
          label="Getekend op (optioneel)"
          naam="getekendOp"
          fout={f.getekendOp}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Regels</legend>
        <p className="text-muted text-xs leading-relaxed">
          Wat je hebt afgesproken, inclusief BTW. Elke regel hoort bij een
          categorie van je budget.
        </p>
        <div className="pt-1">
          <RegelsEditor categorieen={categorieen} categorieVerplicht />
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <label
          htmlFor="contract-notities"
          className="block text-sm font-medium"
        >
          Notities (optioneel)
        </label>
        <textarea
          id="contract-notities"
          name="notities"
          rows={3}
          maxLength={2000}
          className={tekstvakKlassen}
        />
      </div>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <VerzendKnop bezigTekst="Opslaan…">Contract opslaan</VerzendKnop>
    </BlijvendFormulier>
  );
}

// -----------------------------------------------------------------------------
// Gegevens en status
// -----------------------------------------------------------------------------

export function ContractGegevens({
  contract,
  leveranciers,
}: {
  contract: {
    id: string;
    titel: string;
    getekendOp: string | null;
    notities: string | null;
    leverancierId: string | null;
  };
  leveranciers: { id: string; naam: string }[];
}) {
  const [status, actie, bezig] = useActionState(contractBijwerken, leeg);
  const f = status.veldfouten ?? {};
  return (
    <BlijvendFormulier
      actie={actie}
      bezig={bezig}
      className="space-y-4"
      noValidate
    >
      <input type="hidden" name="id" value={contract.id} />
      <LeverancierKeuze
        leveranciers={leveranciers}
        standaard={contract.leverancierId}
        fout={f.nieuweLeverancier}
      />
      <Veld
        label="Naam van het contract"
        naam="titel"
        autoComplete="off"
        defaultValue={contract.titel}
        fout={f.titel}
      />
      <DatumVeld
        label="Getekend op"
        naam="getekendOp"
        defaultValue={contract.getekendOp}
        fout={f.getekendOp}
      />
      <div className="space-y-1.5">
        <label
          htmlFor={`notities-${contract.id}`}
          className="block text-sm font-medium"
        >
          Notities
        </label>
        <textarea
          id={`notities-${contract.id}`}
          name="notities"
          rows={3}
          maxLength={2000}
          defaultValue={contract.notities ?? ""}
          className={tekstvakKlassen}
        />
      </div>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && <Melding soort="succes">{status.succes}</Melding>}
      <VerzendKnop bezigTekst="Opslaan…">Opslaan</VerzendKnop>
    </BlijvendFormulier>
  );
}

const STATUS_UITLEG = {
  actief: {
    label: "Actief",
    tekst: "Loopt nog. De prognose is minimaal het contractbedrag.",
  },
  afgerond: {
    label: "Afgerond",
    tekst:
      "Alles is geleverd en gefactureerd. De prognose wordt wat er gefactureerd is.",
  },
  geannuleerd: {
    label: "Geannuleerd",
    tekst: "Gaat niet door. Alleen wat al gefactureerd is, blijft meetellen.",
  },
} as const;

export function ContractStatus({
  id,
  status: huidig,
  nogTeFactureren,
}: {
  id: string;
  status: keyof typeof STATUS_UITLEG;
  nogTeFactureren: number;
}) {
  const [status, actie, bezig] = useActionState(contractStatusWijzigen, leeg);
  const [keuze, setKeuze] = useState<keyof typeof STATUS_UITLEG>(huidig);
  const basis = useId();
  return (
    <BlijvendFormulier actie={actie} bezig={bezig} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <fieldset className="space-y-2">
        <legend className="sr-only">Status van het contract</legend>
        {(Object.keys(STATUS_UITLEG) as (keyof typeof STATUS_UITLEG)[]).map(
          (s) => (
            <label
              key={s}
              htmlFor={`${basis}-${s}`}
              className={cn(
                "border-border flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3",
                keuze === s && "border-accent bg-accent-soft/40",
              )}
            >
              <input
                id={`${basis}-${s}`}
                type="radio"
                name="status"
                value={s}
                checked={keuze === s}
                onChange={() => setKeuze(s)}
                className="accent-accent mt-0.5 size-4 shrink-0"
              />
              <span>
                <span className="block text-sm font-medium">
                  {STATUS_UITLEG[s].label}
                  {s === huidig && (
                    <span className="text-muted font-normal"> (nu)</span>
                  )}
                </span>
                <span className="text-muted block text-xs leading-relaxed">
                  {STATUS_UITLEG[s].tekst}
                </span>
              </span>
            </label>
          ),
        )}
      </fieldset>
      {keuze !== "actief" && keuze !== huidig && nogTeFactureren > 0 && (
        <p className="bg-warning-soft text-warning rounded-xl px-3 py-2.5 text-sm">
          Er staat nog {formatEuro(nogTeFactureren, { centen: false })} te
          factureren. Dat bedrag telt daarna niet meer mee in de prognose.
        </p>
      )}
      {keuze === "geannuleerd" && keuze !== huidig && (
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="bevestig"
            value="ja"
            className="accent-accent mt-0.5 size-4 shrink-0"
          />
          Ja, annuleer dit contract.
        </label>
      )}
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && <Melding soort="succes">{status.succes}</Melding>}
      <VerzendKnop
        variant="secundair"
        bezigTekst="Opslaan…"
        disabled={keuze === huidig}
      >
        Status opslaan
      </VerzendKnop>
    </BlijvendFormulier>
  );
}

export function ContractVerwijderen({
  id,
  titel,
  vanOfferte,
}: {
  id: string;
  titel: string;
  vanOfferte: boolean;
}) {
  const [status, actie] = useActionState(contractVerwijderen, leeg);
  return (
    <form action={actie} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-muted text-sm">
        {vanOfferte
          ? 'Per ongeluk geaccepteerd? Na verwijderen staat de offerte weer op "ontvangen".'
          : "Alleen mogelijk zolang er geen facturen of bonnen aan hangen."}
      </p>
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
        Contract verwijderen
      </VerzendKnop>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Contractregels
// -----------------------------------------------------------------------------

export type RegelWeergave = {
  id: string;
  omschrijving: string;
  categorieId: string;
  categorie: string;
  /** Afgesproken bedrag van de regel zelf. */
  bedrag: number;
  btw: number;
  gecontracteerd: number;
  gefactureerd: number;
  prognose: number;
  gekoppeldeKosten: number;
  ruimteIds: string[];
};

export function ContractRegels({
  contractId,
  regels,
  categorieen,
  ruimtes,
  magBewerken,
}: {
  contractId: string;
  regels: RegelWeergave[];
  categorieen: CategorieOptie[];
  ruimtes: { id: string; naam: string }[];
  magBewerken: boolean;
}) {
  const [open, setOpen] = useState<{
    id: string;
    wat: "bewerk" | "ruimtes";
  } | null>(null);
  const ruimteNaam = new Map(ruimtes.map((r) => [r.id, r.naam]));
  const heel = { centen: false } as const;

  return (
    <div>
      <ul>
        {regels.map((r, i) => (
          <li key={r.id} className="border-border border-t px-5 py-3.5 sm:px-6">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm font-medium">
                  {r.omschrijving || `Regel ${i + 1}`}
                </p>
                <p className="text-muted mt-0.5 text-xs">
                  {r.categorie}
                  {r.ruimteIds.length > 0 && (
                    <>
                      {" · "}
                      <DoorOpen className="inline size-3 align-[-1px]" />{" "}
                      {r.ruimteIds
                        .map((id) => ruimteNaam.get(id) ?? "?")
                        .join(", ")}
                    </>
                  )}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-x-4 text-right text-sm tabular-nums">
                <div>
                  <dt className="text-muted text-xs">Gecontracteerd</dt>
                  <dd className="font-medium">
                    {formatEuro(r.gecontracteerd, heel)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-xs">Gefactureerd</dt>
                  <dd>{formatEuro(r.gefactureerd, heel)}</dd>
                </div>
                <div>
                  <dt className="text-muted text-xs">Prognose</dt>
                  <dd className="font-medium">
                    {formatEuro(r.prognose, heel)}
                  </dd>
                </div>
              </dl>
            </div>
            {r.gecontracteerd !== r.bedrag && (
              <p className="text-muted mt-1 text-xs">
                Afspraak {formatEuro(r.bedrag)} plus goedgekeurd
                meer-/minderwerk
              </p>
            )}
            {magBewerken && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setOpen(
                      open?.id === r.id && open.wat === "bewerk"
                        ? null
                        : { id: r.id, wat: "bewerk" },
                    )
                  }
                  aria-expanded={open?.id === r.id && open.wat === "bewerk"}
                  className={knopKlassen("stil", "px-2.5 py-1.5 text-xs")}
                >
                  <Pencil className="size-3.5" />
                  Bewerk regel {i + 1}
                </button>
                {ruimtes.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpen(
                        open?.id === r.id && open.wat === "ruimtes"
                          ? null
                          : { id: r.id, wat: "ruimtes" },
                      )
                    }
                    aria-expanded={open?.id === r.id && open.wat === "ruimtes"}
                    className={knopKlassen("stil", "px-2.5 py-1.5 text-xs")}
                  >
                    <DoorOpen className="size-3.5" />
                    Ruimtes regel {i + 1}
                  </button>
                )}
              </div>
            )}
            {open?.id === r.id && open.wat === "bewerk" && (
              <div className="bg-surface-2 mt-3 rounded-xl p-4">
                <RegelFormulier
                  contractId={contractId}
                  regel={r}
                  categorieen={categorieen}
                  onKlaar={() => setOpen(null)}
                />
                {regels.length > 1 && r.gekoppeldeKosten === 0 && (
                  <RegelVerwijderen id={r.id} nummer={i + 1} />
                )}
                {r.gekoppeldeKosten > 0 && (
                  <p className="text-muted mt-3 text-xs">
                    Aan deze regel hangen facturen of bonnen; verwijderen kan
                    niet.
                  </p>
                )}
              </div>
            )}
            {open?.id === r.id && open.wat === "ruimtes" && (
              <div className="bg-surface-2 mt-3 rounded-xl p-4">
                <RuimtesFormulier
                  regelId={r.id}
                  ruimtes={ruimtes}
                  gekozen={r.ruimteIds}
                  onKlaar={() => setOpen(null)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {magBewerken && (
        <div className="border-border border-t px-5 py-4 sm:px-6">
          <NieuweRegel contractId={contractId} categorieen={categorieen} />
        </div>
      )}
    </div>
  );
}

function RegelFormulier({
  contractId,
  regel,
  categorieen,
  onKlaar,
}: {
  contractId: string;
  regel?: RegelWeergave;
  categorieen: CategorieOptie[];
  onKlaar?: () => void;
}) {
  const { status, dispatch, bezig, versie } = useActieMetVersie(
    contractRegelOpslaan,
    onKlaar,
  );
  const f = status.veldfouten ?? {};
  return (
    <>
      <BlijvendFormulier
        key={versie}
        actie={dispatch}
        bezig={bezig}
        className="grid gap-3 sm:grid-cols-2"
        noValidate
      >
        <input type="hidden" name="contractId" value={contractId} />
        <input type="hidden" name="id" value={regel?.id ?? ""} />
        <Veld
          className="sm:col-span-2"
          label="Omschrijving"
          naam="omschrijving"
          autoComplete="off"
          defaultValue={regel?.omschrijving}
          fout={f.omschrijving}
        />
        <CategorieKeuze
          className="sm:col-span-2"
          categorieen={categorieen}
          standaard={regel?.categorieId}
          fout={f.categorieId}
        />
        <BedragVeld
          label="Bedrag incl. BTW"
          naam="bedrag"
          defaultValue={regel?.bedrag ?? null}
          fout={f.bedrag}
        />
        <BtwKeuze standaard={regel?.btw} />
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <VerzendKnop bezigTekst="Opslaan…">
            {regel ? (
              <>
                <Check className="size-4" />
                Regel opslaan
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Regel toevoegen
              </>
            )}
          </VerzendKnop>
          {onKlaar && (
            <button
              type="button"
              onClick={onKlaar}
              className={knopKlassen("stil")}
            >
              <X className="size-4" />
              Annuleren
            </button>
          )}
        </div>
      </BlijvendFormulier>
      {status.fout && (
        <div className="mt-3">
          <Melding soort="fout">{status.fout}</Melding>
        </div>
      )}
      {!onKlaar && status.succes && (
        <div className="mt-3">
          <Melding soort="succes">{status.succes}</Melding>
        </div>
      )}
    </>
  );
}

function NieuweRegel({
  contractId,
  categorieen,
}: {
  contractId: string;
  categorieen: CategorieOptie[];
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={knopKlassen("secundair", "px-3 py-2")}
      >
        <Plus className="size-4" />
        Regel toevoegen
      </button>
    );
  }
  return (
    <RegelFormulier
      contractId={contractId}
      categorieen={categorieen}
      onKlaar={() => setOpen(false)}
    />
  );
}

function RegelVerwijderen({ id, nummer }: { id: string; nummer: number }) {
  const [status, actie] = useActionState(contractRegelVerwijderen, leeg);
  return (
    <form action={actie} className="border-border mt-4 border-t pt-4">
      <input type="hidden" name="id" value={id} />
      <VerzendKnop
        variant="gevaar"
        bezigTekst="Verwijderen…"
        className="px-3 py-2"
      >
        <Trash2 className="size-4" />
        Verwijder regel {nummer}
      </VerzendKnop>
      {status.fout && (
        <div className="mt-3">
          <Melding soort="fout">{status.fout}</Melding>
        </div>
      )}
    </form>
  );
}

function RuimtesFormulier({
  regelId,
  ruimtes,
  gekozen,
  onKlaar,
}: {
  regelId: string;
  ruimtes: { id: string; naam: string }[];
  gekozen: string[];
  onKlaar: () => void;
}) {
  const { status, dispatch, bezig } = useActieMetVersie(
    contractRegelRuimtes,
    onKlaar,
  );
  return (
    <BlijvendFormulier actie={dispatch} bezig={bezig} className="space-y-3">
      <input type="hidden" name="id" value={regelId} />
      <fieldset>
        <legend className="text-sm font-medium">Ruimtes</legend>
        <p className="text-muted mt-0.5 mb-3 text-xs">
          Het bedrag wordt gelijk over de gekozen ruimtes verdeeld. Geen ruimte
          kiezen mag ook.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ruimtes.map((r) => (
            <label key={r.id} className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="ruimteId"
                value={r.id}
                defaultChecked={gekozen.includes(r.id)}
                className="accent-accent size-4 shrink-0"
              />
              {r.naam}
            </label>
          ))}
        </div>
      </fieldset>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <div className="flex flex-wrap gap-2">
        <VerzendKnop bezigTekst="Opslaan…">Ruimtes opslaan</VerzendKnop>
        <button type="button" onClick={onKlaar} className={knopKlassen("stil")}>
          Annuleren
        </button>
      </div>
    </BlijvendFormulier>
  );
}

// -----------------------------------------------------------------------------
// Meer- en minderwerk
// -----------------------------------------------------------------------------

export function WijzigingFormulier({
  contractId,
  regels,
}: {
  contractId: string;
  regels: { id: string; label: string }[];
}) {
  const { status, dispatch, bezig, versie } =
    useActieMetVersie(wijzigingToevoegen);
  const f = status.veldfouten ?? {};
  const regelId = useId();
  return (
    <div className="space-y-3">
      <BlijvendFormulier
        key={versie}
        actie={dispatch}
        bezig={bezig}
        className="grid gap-3 sm:grid-cols-2"
        noValidate
      >
        <input type="hidden" name="contractId" value={contractId} />
        {regels.length === 1 ? (
          <input type="hidden" name="regelId" value={regels[0].id} />
        ) : (
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={regelId} className="block text-sm font-medium">
              Bij regel
            </label>
            <select
              id={regelId}
              name="regelId"
              defaultValue=""
              className="border-border-strong bg-surface focus:border-accent focus:ring-accent/15 block w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none focus:ring-4"
            >
              <option value="" disabled>
                Kies de contractregel
              </option>
              {regels.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            {f.regelId && (
              <p className="text-critical text-xs font-medium">{f.regelId}</p>
            )}
          </div>
        )}
        <Veld
          className="sm:col-span-2"
          label="Omschrijving"
          naam="omschrijving"
          autoComplete="off"
          placeholder="Bijv. extra stopcontacten in de keuken"
          fout={f.omschrijving}
        />
        <BedragVeld
          label="Bedrag incl. BTW"
          naam="bedrag"
          negatiefToegestaan
          hint="Minderwerk met een minteken, bijv. -250,00."
          fout={f.bedrag}
        />
        <BtwKeuze />
        <div className="sm:col-span-2">
          <VerzendKnop bezigTekst="Toevoegen…" variant="secundair">
            <Plus className="size-4" />
            Meer- of minderwerk toevoegen
          </VerzendKnop>
        </div>
      </BlijvendFormulier>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && <Melding soort="succes">{status.succes}</Melding>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Termijnschema
// -----------------------------------------------------------------------------

export function TermijnFormulier({
  contractId,
  restPercentage,
}: {
  contractId: string;
  /** Wat er nog niet is ingepland, als voorstel voor de volgende termijn. */
  restPercentage: number | null;
}) {
  const { status, dispatch, bezig, versie } =
    useActieMetVersie(termijnToevoegen);
  const [soort, setSoort] = useState<"percentage" | "bedrag">("percentage");
  const f = status.veldfouten ?? {};
  const basis = useId();
  return (
    <div className="space-y-3">
      <BlijvendFormulier
        key={versie}
        actie={dispatch}
        bezig={bezig}
        className="grid gap-3 sm:grid-cols-2"
        noValidate
      >
        <input type="hidden" name="contractId" value={contractId} />
        <Veld
          className="sm:col-span-2"
          label="Omschrijving"
          naam="omschrijving"
          autoComplete="off"
          placeholder="Bijv. bij start bouw"
          fout={f.omschrijving}
        />
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Hoogte</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {(
              [
                ["percentage", "Percentage van het contract"],
                ["bedrag", "Vast bedrag"],
              ] as const
            ).map(([waarde, label]) => (
              <label
                key={waarde}
                htmlFor={`${basis}-${waarde}`}
                className="flex items-center gap-2"
              >
                <input
                  id={`${basis}-${waarde}`}
                  type="radio"
                  name="soort"
                  value={waarde}
                  checked={soort === waarde}
                  onChange={() => setSoort(waarde)}
                  className="accent-accent size-4"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {soort === "percentage" ? (
          <Veld
            label="Percentage"
            naam="percentage"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Bijv. 30"
            defaultValue={
              restPercentage && restPercentage > 0
                ? String(restPercentage / 100).replace(".", ",")
                : ""
            }
            hint="Van het contractbedrag inclusief goedgekeurd meerwerk."
            fout={f.percentage}
          />
        ) : (
          <BedragVeld label="Bedrag incl. BTW" naam="bedrag" fout={f.bedrag} />
        )}
        <DatumVeld
          label="Verwacht (optioneel)"
          naam="verwachteDatum"
          fout={f.verwachteDatum}
        />
        <div className="sm:col-span-2">
          <VerzendKnop bezigTekst="Toevoegen…" variant="secundair">
            <Plus className="size-4" />
            Termijn toevoegen
          </VerzendKnop>
        </div>
      </BlijvendFormulier>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && <Melding soort="succes">{status.succes}</Melding>}
    </div>
  );
}
