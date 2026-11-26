import {
  CircleCheck,
  CircleQuestionMark,
  Copy,
  type LucideIcon,
  MessageSquareText,
  TriangleExclamationPoint,
} from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import type { Aandachtspunt } from "@/lib/ai/schema";
import { cn } from "@/lib/cn";

const SOORT: Record<
  Aandachtspunt["soort"],
  { label: string; Icon: LucideIcon; klassen: string; volgorde: number }
> = {
  duplicaat: {
    label: "Mogelijk dubbel",
    Icon: Copy,
    klassen: "bg-critical-soft text-critical",
    volgorde: 0,
  },
  "klopt-niet": {
    label: "Klopt niet",
    Icon: TriangleExclamationPoint,
    klassen: "bg-critical-soft text-critical",
    volgorde: 1,
  },
  ontbreekt: {
    label: "Ontbreekt",
    Icon: TriangleExclamationPoint,
    klassen: "bg-warning-soft text-warning",
    volgorde: 2,
  },
  onzeker: {
    label: "Onzeker",
    Icon: CircleQuestionMark,
    klassen: "bg-info-soft text-info",
    volgorde: 3,
  },
};

/**
 * Wat de controle van het voorstel opleverde: ontbrekende of onjuiste
 * gegevens, onzekere velden en mogelijke duplicaten, plus de opmerkingen
 * van de AI zelf.
 */
export function Aandachtspunten({
  punten,
  opmerkingen,
}: {
  punten: Aandachtspunt[];
  opmerkingen: string[];
}) {
  const gesorteerd = [...punten].sort(
    (a, b) => SOORT[a.soort].volgorde - SOORT[b.soort].volgorde,
  );
  return (
    <Card aria-labelledby="punten-titel">
      <CardHeader
        id="punten-titel"
        title={
          punten.length
            ? `${punten.length} ${punten.length === 1 ? "punt" : "punten"} om te controleren`
            : "Geen bijzonderheden gevonden"
        }
        description={
          punten.length
            ? "Vergelijk deze punten met het origineel en pas het formulier aan waar nodig."
            : "Verplichte gegevens, bedragen, BTW en totalen kloppen. Vergelijk het voorstel toch even met het origineel."
        }
        className="pb-4"
      />
      {gesorteerd.length > 0 ? (
        <ul className="border-border divide-border divide-y border-t">
          {gesorteerd.map((p, i) => {
            const s = SOORT[p.soort];
            return (
              <li
                key={`${p.veld}-${i}`}
                className="flex items-start gap-3 px-5 py-3 sm:px-6"
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    s.klassen,
                  )}
                >
                  <s.Icon className="size-3.5" />
                  {s.label}
                </span>
                <p className="min-w-0 text-sm leading-relaxed">
                  {p.tekst}
                  {p.href && (
                    <>
                      {" "}
                      <Link
                        href={p.href}
                        target="_blank"
                        className="text-accent-ink font-medium whitespace-nowrap hover:underline"
                      >
                        Bekijk dat document
                      </Link>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-positive border-border flex items-center gap-2 border-t px-5 py-3 text-sm font-medium sm:px-6">
          <CircleCheck className="size-4" />
          Alles wat gecontroleerd kon worden, klopt.
        </p>
      )}
      {opmerkingen.length > 0 && (
        <div className="border-border bg-surface-2/60 border-t px-5 py-4 sm:px-6">
          <p className="text-muted flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <MessageSquareText className="size-3.5" />
            Opmerkingen van de AI
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {opmerkingen.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
