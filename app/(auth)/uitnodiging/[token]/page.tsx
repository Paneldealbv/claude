import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { UitnodigingAccepterenFormulier } from "@/components/project/formulieren";
import { knopKlassen, Melding } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { AuthKop } from "../../kop";

export const metadata: Metadata = {
  title: "Uitnodiging",
  // Uitnodigingslinks nooit laten indexeren of doorgeven als referrer.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const ROL_TEKST = {
  eigenaar: "eigenaar (alles beheren, ook leden)",
  bewerker: "bewerker (gegevens toevoegen en wijzigen)",
  lezer: "lezer (alleen bekijken)",
} as const;

type Uitnodiging = {
  project_name: string;
  invited_email: string;
  role: keyof typeof ROL_TEKST;
  invited_by: string;
  status: "geldig" | "verlopen" | "ingetrokken" | "gebruikt";
};

export default async function UitnodigingPagina({
  params,
  searchParams,
}: PageProps<"/uitnodiging/[token]">) {
  const { token } = await params;
  const bevestigd = (await searchParams).bevestigd === "1";
  const supabase = await createClient();

  const [{ data }, { data: claims }] = await Promise.all([
    supabase.rpc("get_invite", { p_token: token }),
    supabase.auth.getClaims(),
  ]);
  const u = (Array.isArray(data) ? data[0] : null) as Uitnodiging | null;
  const ingelogdAls = claims?.claims?.email as string | undefined;
  const hier = `/uitnodiging/${token}`;

  if (!u) {
    return (
      <>
        <AuthKop titel="Uitnodiging niet gevonden" />
        <Melding soort="fout">
          Deze link klopt niet. Controleer of je de volledige link hebt
          gekopieerd, of vraag een nieuwe uitnodiging aan.
        </Melding>
      </>
    );
  }

  if (u.status !== "geldig") {
    const reden = {
      verlopen: "Deze uitnodiging is verlopen.",
      ingetrokken: "Deze uitnodiging is ingetrokken.",
      gebruikt: "Deze uitnodiging is al gebruikt.",
    }[u.status];
    return (
      <>
        <AuthKop titel={u.project_name} />
        <Melding soort="fout">
          {reden} Vraag {u.invited_by} om een nieuwe uitnodiging.
        </Melding>
        {u.status === "gebruikt" && (
          <Link
            href="/dashboard"
            className={knopKlassen("secundair", "mt-6 w-full")}
          >
            Naar het dashboard
          </Link>
        )}
      </>
    );
  }

  const juisteAccount =
    ingelogdAls && ingelogdAls.toLowerCase() === u.invited_email;

  return (
    <>
      {bevestigd && (
        <div className="mb-6">
          <Melding soort="succes">Je e-mailadres is bevestigd.</Melding>
        </div>
      )}
      <AuthKop
        titel={`Uitnodiging voor ${u.project_name}`}
        tekst={
          <>
            {u.invited_by} nodigt je uit als {ROL_TEKST[u.role]}.
          </>
        }
      />
      <div className="border-border bg-surface mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
        <Mail className="text-muted size-4 shrink-0" />
        <span className="text-muted">Voor</span>
        <span className="truncate font-medium">{u.invited_email}</span>
      </div>

      {juisteAccount ? (
        <UitnodigingAccepterenFormulier token={token} />
      ) : ingelogdAls ? (
        <Melding soort="fout">
          Je bent ingelogd als {ingelogdAls}, maar deze uitnodiging is voor{" "}
          {u.invited_email}. Log uit en log in met het juiste account.
        </Melding>
      ) : (
        <div className="space-y-3">
          <Link
            href={`/registreren?volgende=${encodeURIComponent(hier)}&email=${encodeURIComponent(u.invited_email)}`}
            className={knopKlassen("primair", "w-full")}
          >
            Account aanmaken
          </Link>
          <Link
            href={`/inloggen?volgende=${encodeURIComponent(hier)}`}
            className={knopKlassen("secundair", "w-full")}
          >
            Ik heb al een account
          </Link>
        </div>
      )}
    </>
  );
}
