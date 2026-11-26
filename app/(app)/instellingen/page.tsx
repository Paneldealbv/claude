import { Clock, Trash2, UserMinus } from "lucide-react";
import type { Metadata } from "next";
import {
  ProfielFormulier,
  ProjectFormulier,
  UitnodigenFormulier,
} from "@/components/project/formulieren";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import {
  lidVerwijderen,
  rolWijzigen,
  uitnodigingIntrekken,
} from "@/lib/acties/project";
import {
  getActiefProject,
  getGebruiker,
  getLeden,
  initialen,
} from "@/lib/auth";
import { formatDatum } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Instellingen" };

const ROLNAAM = { eigenaar: "Eigenaar", bewerker: "Bewerker", lezer: "Lezer" };

type OpenUitnodiging = {
  id: string;
  email: string;
  role: keyof typeof ROLNAAM;
  expires_at: string;
};

export default async function InstellingenPagina() {
  const [gebruiker, project] = await Promise.all([
    getGebruiker(),
    getActiefProject(),
  ]);
  const leden = await getLeden(project.id);
  const ik = leden.find((l) => l.userId === gebruiker.id);
  const isEigenaar = project.rol === "eigenaar";
  const aantalEigenaren = leden.filter((l) => l.rol === "eigenaar").length;

  // Alleen eigenaren zien uitnodigingen (afgedwongen door RLS).
  let uitnodigingen: OpenUitnodiging[] = [];
  if (isEigenaar) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("project_invites")
      .select("id, email, role, expires_at")
      .eq("project_id", project.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    uitnodigingen = (data ?? []) as OpenUitnodiging[];
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        titel="Instellingen"
        omschrijving="Projectgegevens, je profiel en wie toegang heeft."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="min-w-0 space-y-4 lg:col-span-7 lg:space-y-5">
          <Card aria-labelledby="leden-titel">
            <CardHeader
              id="leden-titel"
              title="Leden"
              description="Iedereen hieronder ziet dezelfde gegevens van dit project."
            />
            <ul className="mt-4">
              {leden.map((l) => {
                const zelf = l.userId === gebruiker.id;
                const laatsteEigenaar =
                  l.rol === "eigenaar" && aantalEigenaren === 1;
                return (
                  <li
                    key={l.userId}
                    className="border-border flex flex-wrap items-center gap-3 border-t px-5 py-3.5 sm:px-6"
                  >
                    <span className="bg-accent-soft text-accent-ink flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {initialen(l.naam)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {l.naam}
                        {zelf && (
                          <span className="text-muted font-normal"> (jij)</span>
                        )}
                      </p>
                      <p className="text-muted truncate text-xs">
                        {l.email} · lid sinds {formatDatum(l.sinds)}
                      </p>
                    </div>
                    {isEigenaar && !laatsteEigenaar ? (
                      <div className="flex items-center gap-1.5">
                        <form
                          action={rolWijzigen}
                          className="flex items-center gap-1.5"
                        >
                          <input type="hidden" name="userId" value={l.userId} />
                          <label
                            htmlFor={`rol-${l.userId}`}
                            className="sr-only"
                          >
                            Rol van {l.naam}
                          </label>
                          <select
                            id={`rol-${l.userId}`}
                            name="rol"
                            defaultValue={l.rol}
                            className="border-border-strong bg-surface rounded-lg border px-2 py-1.5 text-sm"
                          >
                            {Object.entries(ROLNAAM).map(([w, t]) => (
                              <option key={w} value={w}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className={knopKlassen(
                              "secundair",
                              "px-2.5 py-1.5 text-xs",
                            )}
                          >
                            Wijzig
                          </button>
                        </form>
                        <form action={lidVerwijderen}>
                          <input type="hidden" name="userId" value={l.userId} />
                          <button
                            type="submit"
                            title={
                              zelf
                                ? "Project verlaten"
                                : `${l.naam} verwijderen`
                            }
                            className={knopKlassen("gevaar", "px-2.5 py-1.5")}
                          >
                            <UserMinus className="size-4" />
                            <span className="sr-only">
                              {zelf
                                ? "Project verlaten"
                                : `${l.naam} verwijderen`}
                            </span>
                          </button>
                        </form>
                      </div>
                    ) : (
                      <StatusPill
                        soort={l.rol === "eigenaar" ? "info" : "neutraal"}
                      >
                        {ROLNAAM[l.rol]}
                      </StatusPill>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {isEigenaar && (
            <Card aria-labelledby="uitnodigen-titel">
              <CardHeader
                id="uitnodigen-titel"
                title="Iemand uitnodigen"
                description="Je krijgt een persoonlijke link om door te sturen. De ontvanger maakt met dát e-mailadres een account aan."
              />
              <div className="px-5 pt-4 pb-5 sm:px-6">
                <UitnodigenFormulier />
              </div>

              {uitnodigingen.length > 0 && (
                <div className="border-border border-t px-5 py-4 sm:px-6">
                  <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                    Openstaande uitnodigingen
                  </p>
                  <ul className="space-y-2">
                    {uitnodigingen.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center gap-3 text-sm"
                      >
                        <Clock className="text-subtle size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          {u.email}{" "}
                          <span className="text-muted">
                            · {ROLNAAM[u.role]} · geldig tot{" "}
                            {formatDatum(u.expires_at)}
                          </span>
                        </span>
                        <form action={uitnodigingIntrekken}>
                          <input type="hidden" name="inviteId" value={u.id} />
                          <button
                            type="submit"
                            className={knopKlassen("stil", "px-2 py-1 text-xs")}
                          >
                            <Trash2 className="size-3.5" />
                            Intrekken
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5 lg:space-y-5">
          <Card aria-labelledby="project-titel">
            <CardHeader id="project-titel" title="Project" />
            <div className="px-5 pt-4 pb-5 sm:px-6">
              <ProjectFormulier
                naam={project.naam}
                adres={project.adres}
                oplevering={project.oplevering}
                magWijzigen={isEigenaar}
              />
            </div>
          </Card>
          <Card aria-labelledby="profiel-titel">
            <CardHeader
              id="profiel-titel"
              title="Je profiel"
              description={gebruiker.email}
            />
            <div className="px-5 pt-4 pb-5 sm:px-6">
              <ProfielFormulier
                naam={ik?.naam === gebruiker.email ? "" : (ik?.naam ?? "")}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
