"use client";

import {
  CircleCheck,
  Info,
  Loader2,
  TriangleExclamationPoint,
} from "lucide-react";
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useId,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";
import type { ActieStatus } from "@/lib/acties/project";
import { knopKlassen, type KnopVariant } from "./knop";

const BezigContext = createContext(false);

/**
 * Formulier dat de invoer laat staan na versturen. Een gewone
 * <form action={…}> wordt door React na elke verzending leeggemaakt, ook als
 * de server een foutmelding teruggeeft. Bij lange formulieren (regels,
 * uploads, keuzelijsten) is dat vervelend en kunnen keuzelijsten uit de pas
 * gaan lopen met wat er werkelijk wordt verstuurd. Werkt samen met
 * useActionState: geef de actie en de "bezig"-waarde door.
 */
export function BlijvendFormulier({
  actie,
  bezig,
  children,
  ...rest
}: {
  actie: (formData: FormData) => void;
  bezig: boolean;
  children: ReactNode;
} & Omit<ComponentProps<"form">, "action" | "onSubmit" | "children">) {
  return (
    <BezigContext value={bezig}>
      <form
        {...rest}
        onSubmit={(e) => {
          e.preventDefault();
          if (bezig) return;
          const verzender = (e.nativeEvent as SubmitEvent).submitter;
          const formData = new FormData(e.currentTarget, verzender);
          startTransition(() => actie(formData));
        }}
      >
        {children}
      </form>
    </BezigContext>
  );
}

export function Veld({
  label,
  naam,
  fout,
  hint,
  className,
  ...input
}: {
  label: string;
  naam: string;
  fout?: string;
  hint?: ReactNode;
} & Omit<ComponentProps<"input">, "name" | "id">) {
  // Uniek id per veld: meerdere formulieren op één pagina kunnen dezelfde
  // veldnaam hebben (bijv. "naam"), maar een label moet bij zijn eigen veld horen.
  const id = useId();
  const foutId = fout ? `${id}-fout` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={naam}
        aria-invalid={fout ? true : undefined}
        aria-describedby={
          [foutId, hintId].filter(Boolean).join(" ") || undefined
        }
        className={cn(
          "border-border-strong bg-surface placeholder:text-subtle block w-full rounded-xl border px-3.5 py-2.5 text-[15px] shadow-[0_1px_0_rgb(0_0_0/0.02)] transition-colors outline-none",
          "focus:border-accent focus:ring-accent/15 focus:ring-4",
          fout &&
            "border-critical focus:border-critical focus:ring-critical/15",
        )}
        {...input}
      />
      {hint && !fout && (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      )}
      {fout && (
        <p id={foutId} className="text-critical text-xs font-medium">
          {fout}
        </p>
      )}
    </div>
  );
}

/** Verzendknop die zichzelf uitschakelt tijdens het versturen. */
export function VerzendKnop({
  children,
  bezigTekst,
  variant = "primair",
  className,
  disabled,
  ...rest
}: {
  children: ReactNode;
  bezigTekst?: string;
  variant?: KnopVariant;
} & ComponentProps<"button">) {
  const formStatus = useFormStatus();
  const bezig = useContext(BezigContext);
  const pending = formStatus.pending || bezig;
  return (
    <button
      type="submit"
      {...rest}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={knopKlassen(variant, className)}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && bezigTekst ? bezigTekst : children}
    </button>
  );
}

const MELDING = {
  fout: {
    Icon: TriangleExclamationPoint,
    klassen: "bg-critical-soft text-critical",
  },
  succes: { Icon: CircleCheck, klassen: "bg-positive-soft text-positive" },
  "let-op": {
    Icon: TriangleExclamationPoint,
    klassen: "bg-warning-soft text-warning",
  },
  info: { Icon: Info, klassen: "bg-info-soft text-info" },
} as const;

export function Melding({
  soort,
  children,
}: {
  soort: keyof typeof MELDING;
  children: ReactNode;
}) {
  const { Icon, klassen } = MELDING[soort];
  return (
    <div
      role={soort === "fout" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm",
        klassen,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

const leeg: ActieStatus = {};
type Actie = (vorige: ActieStatus, formData: FormData) => Promise<ActieStatus>;

/**
 * Actie met een "versie" die ophoogt na succes: geef die als key aan het
 * formulier, dan begint het daarna weer leeg.
 */
export function useActieMetVersie(actie: Actie, naSucces?: () => void) {
  const [versie, setVersie] = useState(0);
  const [status, dispatch, bezig] = useActionState(
    async (vorige: ActieStatus, fd: FormData) => {
      const uit = await actie(vorige, fd);
      if (uit.succes) {
        setVersie((v) => v + 1);
        naSucces?.();
      }
      return uit;
    },
    leeg,
  );
  return { status, dispatch, bezig, versie };
}
