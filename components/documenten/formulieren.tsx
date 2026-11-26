"use client";

import {
  Ban,
  BookCheck,
  RotateCcw,
  Trash2,
  TriangleExclamationPoint,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { BestandUpload } from "@/components/invoer/bestand-upload";
import {
  KostenRegelsEditor,
  type DoelGroep,
  type KostenRegelInvoer,
} from "@/components/invoer/kosten-regels-editor";
import { keuzeKlassen } from "@/components/invoer/keuzes";
import {
  LeverancierKeuze,
  type NieuweLeverancier,
} from "@/components/invoer/leverancier-keuze";
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
import {
  betalingToevoegen,
  documentOpslaan,
  documentStatusWijzigen,
  documentVerwijderen,
} from "@/lib/acties/documenten";
import type { ActieStatus } from "@/lib/acties/project";
import type { FormulierVeld } from "@/lib/ai/voorstel";
import { cn } from "@/lib/cn";
import { DOCUMENT_TYPE, type DocumentSoort } from "@/lib/labels";

const leeg: ActieStatus = {};

export type ContractKeuze = {
  id: string;
  titel: string;
  leverancier: string | null;
  geannuleerd: boolean;
  regels: { id: string; label: string }[];
  termijnen: { id: string; label: string }[];
};

export type DocumentInvoer = {
  id?: string;
  type: DocumentSoort;
  status?: "concept" | "te_controleren" | "geboekt";
  leverancierId: string | null;
  contractId: string | null;
  termijnId: string | null;
  nummer: string | null;
  datum: string | null;
  vervalDatum: string | null;
  /** Zoals op het papier; bij een creditnota positief. */
  totaalOpDocument: number | null;
  notities: string | null;
  regels: KostenRegelInvoer[];
};

export type BestandKeuze = {
  id: string;
  naam: string;
  grootte?: number;
  type?: string;
};

const SOORTEN = Object.keys(DOCUMENT_TYPE) as DocumentSoort[];

/** Aandachtspunten van de AI per formulierveld. */
export type LetOpPerVeld = Partial<Record<FormulierVeld, string[]>>;

function LetOp({ punten }: { punten?: string[] }) {
  if (!punten?.length) return null;
  return (
    <ul className="text-warning mt-1.5 space-y-0.5 text-xs font-medium">
      {punten.map((p) => (
        <li key={p} className="flex items-start gap-1.5">
          <TriangleExclamationPoint className="mt-px size-3.5 shrink-0" />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

/** Factuur, termijnfactuur, eindfactuur, creditnota of bon invoeren. */
export function DocumentFormulier({
  document,
  bestand,
  leveranciers,
  contracten,
  categorieen,
  ruimtes,
  extractieId,
  bestandVast = false,
  letOp = {},
  nieuweLeverancier,
}: {
  document: DocumentInvoer;
  bestand?: BestandKeuze | null;
  leveranciers: { id: string; naam: string }[];
  contracten: ContractKeuze[];
  categorieen: { id: string; label: string }[];
  ruimtes: { id: string; naam: string }[];
  /** Opslaan vanuit een AI-voorstel (controlescherm). */
  extractieId?: string;
  /** Het bestand hoort vast bij dit formulier (geen ander kiezen). */
  bestandVast?: boolean;
  letOp?: LetOpPerVeld;
  /** Voorstel voor een nieuwe leverancier. */
  nieuweLeverancier?: NieuweLeverancier | null;
}) {
  const [status, actie, bezig] = useActionState(documentOpslaan, leeg);
  const f = status.veldfouten ?? {};
  const [type, setType] = useState<DocumentSoort>(document.type);
  const [contractId, setContractId] = useState(document.contractId ?? "");
  const [totaal, setTotaal] = useState<number | null>(
    document.totaalOpDocument,
  );
  const basis = useId();
  const geboekt = document.status === "geboekt";
  const contract = contracten.find((c) => c.id === contractId);

  const doelen: DoelGroep[] = [
    ...contracten
      .filter(
        (c) =>
          !c.geannuleerd ||
          c.id === contractId ||
          document.regels.some(
            (r) =>
              r.doel === `c:${c.id}` ||
              c.regels.some((x) => r.doel === `r:${x.id}`),
          ),
      )
      .map((c) => ({
        label: `Contract: ${c.titel}`,
        opties: [
          { waarde: `c:${c.id}`, label: "Hele contract (naar rato verdeeld)" },
          ...c.regels.map((r) => ({ waarde: `r:${r.id}`, label: r.label })),
        ],
      })),
    {
      label: "Losse kosten (categorie)",
      opties: categorieen.map((c) => ({ waarde: `k:${c.id}`, label: c.label })),
    },
  ];

  return (
    <BlijvendFormulier
      actie={actie}
      bezig={bezig}
      className="space-y-6"
      noValidate
    >
      <input type="hidden" name="id" value={document.id ?? ""} />
      {extractieId && (
        <input type="hidden" name="extractieId" value={extractieId} />
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Soort document</legend>
        <div className="flex flex-wrap gap-2">
          {SOORTEN.map((s) => (
            <label
              key={s}
              htmlFor={`${basis}-${s}`}
              className={cn(
                "border-border-strong cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                type === s
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "text-muted hover:text-foreground",
              )}
            >
              <input
                id={`${basis}-${s}`}
                type="radio"
                name="type"
                value={s}
                checked={type === s}
                onChange={() => setType(s)}
                className="sr-only"
              />
              {DOCUMENT_TYPE[s].tekst}
            </label>
          ))}
        </div>
        {f.type && (
          <p className="text-critical mt-1 text-xs font-medium">{f.type}</p>
        )}
        <LetOp punten={letOp.soort} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <LeverancierKeuze
            leveranciers={leveranciers}
            standaard={document.leverancierId}
            standaardNieuw={nieuweLeverancier}
            fout={f.nieuweLeverancier ?? f.leverancierId}
          />
          <LetOp punten={letOp.leverancier} />
          {!document.leverancierId && !nieuweLeverancier && (
            <p className="text-muted mt-1 text-xs">
              {type === "bon"
                ? "Bijvoorbeeld de bouwmarkt. Mag leeg blijven."
                : "Leeg laten bij een contract: dan geldt de leverancier van het contract."}
            </p>
          )}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label
            htmlFor={`${basis}-contract`}
            className="block text-sm font-medium"
          >
            Contract
            {type === "termijnfactuur" || type === "eindfactuur"
              ? ""
              : " (optioneel)"}
          </label>
          <select
            id={`${basis}-contract`}
            name="contractId"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            aria-invalid={f.contractId ? true : undefined}
            className={cn(keuzeKlassen, f.contractId && "border-critical")}
          >
            <option value="">Geen contract</option>
            {contracten
              .filter((c) => !c.geannuleerd || c.id === contractId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titel}
                  {c.leverancier ? ` · ${c.leverancier}` : ""}
                </option>
              ))}
          </select>
          {f.contractId && (
            <p className="text-critical text-xs font-medium">{f.contractId}</p>
          )}
          <LetOp punten={letOp.contract} />
        </div>
        {type === "termijnfactuur" &&
          contract &&
          contract.termijnen.length > 0 && (
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor={`${basis}-termijn`}
                className="block text-sm font-medium"
              >
                Termijn
              </label>
              <select
                id={`${basis}-termijn`}
                name="termijnId"
                defaultValue={document.termijnId ?? ""}
                className={keuzeKlassen}
              >
                <option value="">Geen specifieke termijn</option>
                {contract.termijnen.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        <div>
          <Veld
            label={type === "bon" ? "Bonnummer (optioneel)" : "Factuurnummer"}
            naam="nummer"
            autoComplete="off"
            defaultValue={document.nummer ?? ""}
            fout={f.nummer}
          />
          <LetOp punten={letOp.nummer} />
        </div>
        <div>
          <DatumVeld
            label="Datum"
            naam="datum"
            defaultValue={document.datum}
            fout={f.datum}
          />
          <LetOp punten={letOp.datum} />
        </div>
        {type !== "bon" && (
          <div>
            <DatumVeld
              label="Uiterlijk betalen op (optioneel)"
              naam="vervalDatum"
              defaultValue={document.vervalDatum}
              fout={f.vervalDatum}
            />
            <LetOp punten={letOp.vervalDatum} />
          </div>
        )}
        <div>
          <BedragVeld
            label={
              extractieId
                ? "Totaal op het document"
                : "Totaal op het document (optioneel)"
            }
            naam="totaal"
            defaultValue={document.totaalOpDocument}
            hint="Incl. BTW. Zo controleert het dashboard of de regels kloppen."
            fout={f.totaal}
            onWaarde={setTotaal}
          />
          <LetOp punten={letOp.totaal} />
        </div>
        {bestandVast && bestand ? (
          <input type="hidden" name="bestandId" value={bestand.id} />
        ) : (
          <div className="sm:col-span-2">
            <BestandUpload
              label={
                type === "bon" ? "Bon (foto of PDF)" : "Document (PDF of foto)"
              }
              standaard={bestand}
            />
          </div>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Regels</legend>
        <p className="text-muted text-xs leading-relaxed">
          {type === "creditnota"
            ? "Vul de bedragen in zoals op de creditnota (zonder minteken); ze worden van de kosten afgetrokken."
            : "Verdeel het document over contracten of categorieën. Eén bon kan over meerdere regels; het document zelf wordt één keer bewaard."}
        </p>
        <LetOp punten={letOp.regels} />
        <div className="pt-1">
          <KostenRegelsEditor
            doelen={doelen}
            ruimtes={ruimtes}
            standaard={document.regels}
            standaardDoel={contractId ? `c:${contractId}` : ""}
            totaalOpDocument={totaal}
          />
        </div>
      </fieldset>

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
          defaultValue={document.notities ?? ""}
          className={tekstvakKlassen}
        />
      </div>

      {status.fout && (
        <Melding soort="fout">
          {status.fout}
          {status.link && (
            <>
              {" "}
              <Link href={status.link} className="font-semibold underline">
                Bekijk het bestaande document
              </Link>
            </>
          )}
        </Melding>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {geboekt ? (
          <VerzendKnop name="actie" value="opslaan" bezigTekst="Opslaan…">
            Wijzigingen opslaan
          </VerzendKnop>
        ) : (
          <>
            <VerzendKnop name="actie" value="boeken" bezigTekst="Opslaan…">
              <BookCheck className="size-4" />
              Boeken
            </VerzendKnop>
            <VerzendKnop
              name="actie"
              value="concept"
              variant="secundair"
              bezigTekst="Opslaan…"
            >
              Opslaan als concept
            </VerzendKnop>
          </>
        )}
        <p className="text-muted text-xs">
          {geboekt
            ? "Het document blijft geboekt."
            : "Alleen geboekte documenten tellen mee in je cijfers."}
        </p>
      </div>
    </BlijvendFormulier>
  );
}

// -----------------------------------------------------------------------------
// Status
// -----------------------------------------------------------------------------

export function DocumentStatusActies({
  id,
  status: huidig,
  heeftBetalingen,
}: {
  id: string;
  status: "concept" | "te_controleren" | "geboekt" | "vervallen";
  heeftBetalingen: boolean;
}) {
  const [status, actie] = useActionState(documentStatusWijzigen, leeg);
  const knop = (
    naar: string,
    inhoud: React.ReactNode,
    variant: "primair" | "secundair" = "secundair",
  ) => (
    <form action={actie}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="naar" value={naar} />
      <VerzendKnop variant={variant} bezigTekst="Bezig…" className="px-3 py-2">
        {inhoud}
      </VerzendKnop>
    </form>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(huidig === "concept" || huidig === "te_controleren") &&
          knop(
            "geboekt",
            <>
              <BookCheck className="size-4" />
              Boeken
            </>,
            "primair",
          )}
        {huidig === "geboekt" &&
          !heeftBetalingen &&
          knop(
            "concept",
            <>
              <RotateCcw className="size-4" />
              Terug naar concept
            </>,
          )}
        {huidig === "vervallen" &&
          knop(
            "concept",
            <>
              <RotateCcw className="size-4" />
              Herstellen als concept
            </>,
          )}
      </div>
      {huidig === "geboekt" && heeftBetalingen && (
        <p className="text-muted text-sm">
          Er zijn betalingen vastgelegd. Corrigeren kan via Bewerken; om het
          document terug te zetten of te laten vervallen, verwijder je eerst de
          betalingen.
        </p>
      )}
      {huidig !== "vervallen" && !heeftBetalingen && (
        <details className="text-sm">
          <summary className="text-muted hover:text-foreground cursor-pointer">
            Document laten vervallen
          </summary>
          <form action={actie} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="naar" value="vervallen" />
            <p className="text-muted">
              Bijvoorbeeld als een factuur is vervangen door een nieuwe. Het
              document blijft bewaard, maar telt nergens meer mee.
            </p>
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                name="bevestig"
                value="ja"
                className="accent-accent mt-0.5 size-4 shrink-0"
              />
              Ja, dit document vervalt.
            </label>
            <VerzendKnop
              variant="gevaar"
              bezigTekst="Bezig…"
              className="px-3 py-2"
            >
              <Ban className="size-4" />
              Laten vervallen
            </VerzendKnop>
          </form>
        </details>
      )}
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && <Melding soort="succes">{status.succes}</Melding>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Betalingen
// -----------------------------------------------------------------------------

export function BetalingFormulier({
  documentId,
  openstaand,
  bronnen,
  vandaag,
}: {
  documentId: string;
  openstaand: number;
  bronnen: { id: string; naam: string }[];
  vandaag: string;
}) {
  const { status, dispatch, bezig, versie } =
    useActieMetVersie(betalingToevoegen);
  const f = status.veldfouten ?? {};
  const bronId = useId();
  const terug = openstaand < 0;
  return (
    <div className="space-y-3">
      <BlijvendFormulier
        key={versie}
        actie={dispatch}
        bezig={bezig}
        className="grid gap-3 sm:grid-cols-2"
        noValidate
      >
        <input type="hidden" name="documentId" value={documentId} />
        <BedragVeld
          label={terug ? "Terugontvangen bedrag" : "Bedrag"}
          naam="bedrag"
          defaultValue={Math.abs(openstaand) || null}
          fout={f.bedrag}
        />
        <DatumVeld
          label={terug ? "Ontvangen op" : "Betaald op"}
          naam="datum"
          defaultValue={vandaag}
          fout={f.datum}
        />
        {bronnen.length > 0 && (
          <div className="space-y-1.5">
            <label htmlFor={bronId} className="block text-sm font-medium">
              Betaald uit (optioneel)
            </label>
            <select
              id={bronId}
              name="bronId"
              defaultValue=""
              className={keuzeKlassen}
            >
              <option value="">Niet vastgelegd</option>
              {bronnen.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.naam}
                </option>
              ))}
            </select>
          </div>
        )}
        <Veld
          className={bronnen.length > 0 ? "" : "sm:col-span-2"}
          label="Omschrijving (optioneel)"
          naam="omschrijving"
          autoComplete="off"
          placeholder="Bijv. overboeking of pin"
          fout={f.omschrijving}
        />
        <div className="sm:col-span-2">
          <VerzendKnop bezigTekst="Opslaan…" variant="secundair">
            {terug ? "Terugbetaling vastleggen" : "Betaling vastleggen"}
          </VerzendKnop>
        </div>
      </BlijvendFormulier>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      {status.succes && <Melding soort="succes">{status.succes}</Melding>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Verwijderen
// -----------------------------------------------------------------------------

export function DocumentVerwijderen({
  id,
  heeftBetalingen,
}: {
  id: string;
  heeftBetalingen: boolean;
}) {
  const [status, actie] = useActionState(documentVerwijderen, leeg);
  return (
    <form action={actie} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-muted text-sm">
        {heeftBetalingen
          ? "De vastgelegde betalingen worden ook verwijderd. "
          : ""}
        Het bestand wordt ook verwijderd, tenzij het nog bij een ander stuk
        hoort.
      </p>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="bevestig"
          value="ja"
          className="accent-accent mt-0.5 size-4 shrink-0"
        />
        Ja, verwijder dit document definitief.
      </label>
      {status.fout && <Melding soort="fout">{status.fout}</Melding>}
      <VerzendKnop variant="gevaar" bezigTekst="Verwijderen…">
        <Trash2 className="size-4" />
        Document verwijderen
      </VerzendKnop>
    </form>
  );
}
