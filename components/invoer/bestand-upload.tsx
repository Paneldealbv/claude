"use client";

import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { Melding } from "@/components/ui/form";
import { knopKlassen } from "@/components/ui/knop";
import {
  bestandRegistreren,
  bestandVoorbereiden,
} from "@/lib/acties/bestanden";
import {
  ACCEPT_ATTRIBUUT,
  controleerBestand,
  formatBestandsgrootte,
} from "@/lib/bestanden";
import { uploadClient } from "@/lib/supabase/browser";

type Gekozen = { id: string; naam: string; grootte?: number; type?: string };

const PER_EXTENSIE: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** Sommige browsers geven geen type mee (bijv. bij HEIC); dan op extensie. */
function typeVan(bestand: File): string {
  if (bestand.type) return bestand.type;
  const ext = bestand.name.split(".").pop()?.toLowerCase() ?? "";
  return PER_EXTENSIE[ext] ?? "";
}

/** Langste zijde na verkleinen: scherp genoeg voor kleine tekst op een bon. */
const MAX_ZIJDE = 2400;

/**
 * Grote foto's verkleinen voor het uitlezen (sneller uploaden; de AI leest
 * maximaal 5 MB per foto). Lukt het niet, dan blijft het origineel.
 */
async function verklein(bestand: File, type: string): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(type)) return bestand;
  try {
    const beeld = await createImageBitmap(bestand, {
      imageOrientation: "from-image",
    });
    const schaal = Math.min(1, MAX_ZIJDE / Math.max(beeld.width, beeld.height));
    if (schaal === 1 && bestand.size <= 1.5 * 1024 * 1024) {
      beeld.close();
      return bestand;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(beeld.width * schaal);
    canvas.height = Math.round(beeld.height * schaal);
    const ctx = canvas.getContext("2d");
    if (!ctx) return bestand;
    ctx.fillStyle = "#ffffff"; // transparante PNG's: witte achtergrond
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(beeld, 0, 0, canvas.width, canvas.height);
    beeld.close();
    const blob = await new Promise<Blob | null>((klaar) =>
      canvas.toBlob(klaar, "image/jpeg", 0.85),
    );
    if (!blob || blob.size >= bestand.size) return bestand;
    const naam = `${bestand.name.replace(/\.[^.]+$/, "") || "foto"}.jpg`;
    return new File([blob], naam, { type: "image/jpeg" });
  } catch {
    return bestand;
  }
}

async function sha256(bestand: File): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    await bestand.arrayBuffer(),
  );
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Bestand (PDF of foto) uploaden naar de privé opslag van het project.
 * Het formulier krijgt alleen het id van het opgeslagen bestand mee.
 */
export function BestandUpload({
  naam = "bestandId",
  label = "Document (PDF of foto)",
  standaard = null,
  accept,
  verkleinFoto = false,
  camera = false,
  leegTekst = "Kies een PDF of foto (max. 20 MB)",
  onGekozen,
}: {
  naam?: string;
  label?: string;
  standaard?: Gekozen | null;
  /** Alleen deze typen (bijv. wat de AI kan lezen); standaard alle. */
  accept?: readonly string[];
  /** Grote foto's eerst verkleinen (voor het uitlezen). */
  verkleinFoto?: boolean;
  /** Op een telefoon meteen de camera openen. */
  camera?: boolean;
  leegTekst?: string;
  onGekozen?: (bestand: Gekozen | null) => void;
}) {
  const id = useId();
  const invoer = useRef<HTMLInputElement>(null);
  const [gekozen, setGekozen] = useState<Gekozen | null>(standaard);
  const [bezig, setBezig] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [opmerking, setOpmerking] = useState<string | null>(null);

  function kies(bestand: Gekozen | null) {
    setGekozen(bestand);
    onGekozen?.(bestand);
  }

  async function verwerk(origineel: File) {
    setFout(null);
    setOpmerking(null);
    let bestand = origineel;
    let type = typeVan(bestand);
    if (accept && !accept.includes(type)) {
      return setFout("Kies een PDF of een foto (JPG, PNG of WEBP).");
    }
    if (verkleinFoto) {
      setBezig("Foto voorbereiden…");
      bestand = await verklein(bestand, type);
      type = typeVan(bestand);
    }
    const probleem = controleerBestand(type, bestand.size);
    if (probleem) {
      setBezig(null);
      return setFout(probleem);
    }

    try {
      setBezig("Bestand controleren…");
      const meta = {
        naam: bestand.name,
        type,
        grootte: bestand.size,
        sha256: await sha256(bestand),
      };
      const voorbereid = await bestandVoorbereiden(meta);
      if (voorbereid.status === "fout") return setFout(voorbereid.fout);
      if (voorbereid.status === "bestaat") {
        kies({ id: voorbereid.bestandId, naam: voorbereid.naam });
        setOpmerking(
          "Dit bestand stond al in je project; het bestaande bestand wordt gebruikt.",
        );
        return;
      }

      setBezig("Uploaden…");
      const { error } = await uploadClient()
        .storage.from("documenten")
        .uploadToSignedUrl(voorbereid.pad, voorbereid.token, bestand, {
          contentType: type,
        });
      if (error)
        return setFout(
          "Uploaden is mislukt. Controleer je verbinding en probeer het opnieuw.",
        );

      setBezig("Opslaan…");
      const geregistreerd = await bestandRegistreren({
        ...meta,
        pad: voorbereid.pad,
      });
      if (geregistreerd.status === "fout") return setFout(geregistreerd.fout);
      kies({
        id: geregistreerd.bestandId,
        naam: bestand.name,
        grootte: bestand.size,
        type,
      });
    } catch {
      setFout("Uploaden is mislukt. Probeer het opnieuw.");
    } finally {
      setBezig(null);
      if (invoer.current) invoer.current.value = "";
    }
  }

  const Icon = gekozen?.type?.startsWith("image/") ? ImageIcon : FileText;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input type="hidden" name={naam} value={gekozen?.id ?? ""} />
      <input
        ref={invoer}
        id={id}
        type="file"
        accept={accept ? accept.join(",") : ACCEPT_ATTRIBUUT}
        capture={camera ? "environment" : undefined}
        className="sr-only"
        onChange={(e) => {
          const bestand = e.target.files?.[0];
          if (bestand) void verwerk(bestand);
        }}
      />
      {gekozen ? (
        <div className="border-border bg-surface-2 flex items-center gap-3 rounded-xl border px-3.5 py-2.5">
          <Icon className="text-muted size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{gekozen.naam}</p>
            {gekozen.grootte && (
              <p className="text-muted text-xs">
                {formatBestandsgrootte(gekozen.grootte)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              kies(null);
              setOpmerking(null);
            }}
            className={knopKlassen("stil", "px-2 py-1.5")}
            title="Bestand loskoppelen"
          >
            <X className="size-4" />
            <span className="sr-only">Bestand loskoppelen</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={Boolean(bezig)}
          onClick={() => invoer.current?.click()}
          className="border-border-strong hover:bg-surface-2 text-muted flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-4 text-sm transition-colors disabled:opacity-70"
        >
          {bezig ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="size-4" />
          )}
          {bezig ?? leegTekst}
        </button>
      )}
      {opmerking && (
        <p className="text-warning text-xs font-medium">{opmerking}</p>
      )}
      {fout && <Melding soort="fout">{fout}</Melding>}
    </div>
  );
}
