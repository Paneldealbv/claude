"use client";

import {
  Camera,
  FileText,
  type LucideIcon,
  PencilLine,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type Ctx = { open: () => void };
const AddDocumentContext = createContext<Ctx | null>(null);

export function useAddDocument() {
  const ctx = useContext(AddDocumentContext);
  if (!ctx) throw new Error("useAddDocument buiten AddDocumentProvider");
  return ctx;
}

const opties: {
  icon: LucideIcon;
  titel: string;
  tekst: string;
  fase: string;
}[] = [
  {
    icon: Camera,
    titel: "Bon fotograferen",
    tekst: "Maak een foto met je telefoon. De AI leest de regels uit.",
    fase: "fase 6 en 8",
  },
  {
    icon: Upload,
    titel: "Factuur uploaden",
    tekst: "PDF of afbeelding van een (termijn)factuur of creditnota.",
    fase: "fase 6",
  },
  {
    icon: FileText,
    titel: "Offerte uploaden",
    tekst: "Bewaar de offerte en zet hem later om in een contract.",
    fase: "fase 5",
  },
  {
    icon: PencilLine,
    titel: "Handmatig invoeren",
    tekst: "Zonder document, bijvoorbeeld een contante betaling.",
    fase: "fase 6",
  },
];

export function AddDocumentProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = useCallback(() => ref.current?.showModal(), []);
  const close = () => ref.current?.close();
  const value = useMemo(() => ({ open }), [open]);

  return (
    <AddDocumentContext.Provider value={value}>
      {children}
      <dialog
        ref={ref}
        aria-labelledby="toevoegen-titel"
        className="anim-pop bg-surface text-foreground shadow-pop m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl p-0"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2
              id="toevoegen-titel"
              className="text-lg font-semibold tracking-tight"
            >
              Document toevoegen
            </h2>
            <p className="text-muted mt-1 text-sm">
              Kies hoe je een bon, factuur of offerte wilt toevoegen.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="text-muted hover:bg-surface-2 hover:text-foreground -mt-1 -mr-2 rounded-lg p-2"
            aria-label="Sluiten"
          >
            <X className="size-5" />
          </button>
        </div>

        <ul className="grid gap-2 p-4 sm:grid-cols-2 sm:p-6">
          {opties.map((o) => (
            <li key={o.titel}>
              <button
                type="button"
                disabled
                aria-describedby="toevoegen-demo"
                className="border-border bg-surface flex h-full w-full cursor-not-allowed items-start gap-3 rounded-xl border p-3.5 text-left sm:flex-col sm:p-4"
              >
                <span className="bg-accent-soft text-accent-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <o.icon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{o.titel}</span>
                  <span className="text-muted mt-0.5 block text-xs leading-relaxed">
                    {o.tekst}
                  </span>
                  <span className="text-subtle mt-1.5 block text-[11px] font-medium tracking-wide uppercase">
                    Beschikbaar in {o.fase}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div
          id="toevoegen-demo"
          className="border-border bg-surface-2 text-muted flex items-start gap-2 rounded-b-2xl border-t px-6 py-4 text-xs leading-relaxed"
        >
          <Sparkles className="text-accent-ink mt-px size-4 shrink-0" />
          Dit is de ontwerp-shell. Uploaden en AI-herkenning worden in latere
          fasen gekoppeld. Een AI-voorstel wordt altijd eerst door jou
          gecontroleerd voordat het meetelt.
        </div>
      </dialog>
    </AddDocumentContext.Provider>
  );
}

/** Opvallende knop in de zijbalk. */
export function AddDocumentButton({
  className,
  voorOpenen,
}: {
  className?: string;
  /** Bijv. de mobiele menulade eerst sluiten. */
  voorOpenen?: () => void;
}) {
  const { open } = useAddDocument();
  return (
    <button
      type="button"
      onClick={() => {
        voorOpenen?.();
        open();
      }}
      className={cn(
        "bg-gold text-gold-foreground hover:bg-gold-hover flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_6px_16px_-6px_rgb(201_164_92/0.6)] transition-colors",
        className,
      )}
    >
      <Plus className="size-[18px]" strokeWidth={2.5} />
      Bon of factuur toevoegen
    </button>
  );
}

/** Ronde "+"-knop midden in de mobiele tabbalk. */
export function AddDocumentFab() {
  const { open } = useAddDocument();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Bon of factuur toevoegen"
      className="bg-gold text-gold-foreground hover:bg-gold-hover ring-surface -mt-6 flex size-14 items-center justify-center rounded-full shadow-[0_10px_24px_-8px_rgb(201_164_92/0.8)] ring-4 transition-colors"
    >
      <Plus className="size-6" strokeWidth={2.5} />
    </button>
  );
}
