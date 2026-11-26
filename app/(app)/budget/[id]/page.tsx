import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Lock,
  LockOpen,
  TriangleExclamationPoint,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Afwijking } from "@/components/budget/categorie-tabel";
import {
  AfsluitFormulier,
  BudgetRegels,
  CategorieToevoegenFormulier,
  HernoemFormulier,
  VerwijderFormulier,
} from "@/components/budget/formulieren";
import { Card, CardHeader } from "@/components/ui/card";
import { knopKlassen } from "@/components/ui/knop";
import { StatusPill } from "@/components/ui/status";
import { categorieHeropenen, categorieVerplaatsen } from "@/lib/acties/budget";
import { getActiefProject } from "@/lib/auth";
import { laadOffertes } from "@/lib/data/offertes";
import { laadProjectResultaat } from "@/lib/data/project";
import { controleerAfsluiten, type Cijfers } from "@/lib/finance";
import { formatDatum, formatEuro } from "@/lib/format";
import { STATUS_CONTRACT } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const heel = { centen: false } as const;

export async function generateMetadata({
  params,
}: PageProps<"/budget/[id]">): Promise<Metadata> {
  const { id } = await params;
  const project = await getActiefProject();
  const { invoer } = await laadProjectResultaat(project.id);
  return {
    title: invoer.categorieen.find((c) => c.id === id)?.naam ?? "Categorie",
  };
}

function Cijfer({
  label,
  waarde,
  extra,
}: {
  label: string;
  waarde: number;
  extra?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-surface shadow-card rounded-2xl border p-4">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight whitespace-nowrap">
        {formatEuro(waarde, heel)}
      </p>
      {extra && <div className="mt-1.5">{extra}</div>}
    </div>
  );
}

export default async function CategoriePagina({
  params,
}: PageProps<"/budget/[id]">) {
  const { id } = await params;
  const project = await getActiefProject();
  const [{ invoer, resultaat, vandaag }, offertes] = await Promise.all([
    laadProjectResultaat(project.id),
    laadOffertes(project.id),
  ]);
  const cat = resultaat.categorieen.find((c) => c.id === id);
  if (!cat) notFound();

  const magBewerken = project.rol !== "lezer";
  const c: Cijfers = cat.cijfers;
  const perId = new Map(invoer.categorieen.map((x) => [x.id, x]));

  // Pad naar boven (voor kruimelpad en "afgesloten via …").
  const pad: { id: string; naam: string; afgesloten: boolean }[] = [];
  for (
    let p = cat.parentId ? perId.get(cat.parentId) : undefined;
    p;
    p = p.parentId ? perId.get(p.parentId) : undefined
  ) {
    pad.unshift({ id: p.id, naam: p.naam, afgesloten: p.afgesloten });
    if (pad.length > 10) break;
  }
  const geslotenOuder = [...pad].reverse().find((p) => p.afgesloten);
  const kinderen = resultaat.categorieen.filter((x) => x.parentId === id);
  const broers = invoer.categorieen
    .filter((x) => x.parentId === cat.parentId)
    .sort(
      (a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, "nl"),
    );
  const plek = broers.findIndex((x) => x.id === id);

  const supabase = await createClient();
  const [{ data: regels }, { data: rij }] = await Promise.all([
    supabase
      .from("budget_lines")
      .select("id, description, amount_incl_cents, vat_rate_bp")
      .eq("category_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("categories")
      .select("closed_at, closed_by")
      .eq("id", id)
      .single(),
  ]);
  const budgetRegels = (regels ?? []).map((r) => ({
    id: r.id,
    omschrijving: r.description,
    bedrag: r.amount_incl_cents,
    btw: r.vat_rate_bp,
  }));

  let afgeslotenDoor: string | null = null;
  if (cat.eigenAfgesloten && rij?.closed_by) {
    const { data: profiel } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", rij.closed_by)
      .maybeSingle();
    afgeslotenDoor = profiel?.full_name || profiel?.email || null;
  }

  const heeftKosten =
    invoer.contractRegels.some((r) => r.categorieId === id) ||
    invoer.kostenRegels.some((r) => r.categorieId === id);
  // Offerteregels blokkeren subcategorieën ook (de database controleert dit).
  const heeftOfferteRegels = offertes.some((o) =>
    o.regels.some((r) => r.categorieId === id),
  );
  const magSubcategorie =
    magBewerken &&
    (kinderen.length > 0 ||
      (budgetRegels.length === 0 && !heeftKosten && !heeftOfferteRegels));

  // Contracten met regels in deze categorie (of een subcategorie ervan).
  const inBoom = new Set([id]);
  for (let groei = true; groei;) {
    groei = false;
    for (const x of invoer.categorieen) {
      if (x.parentId && inBoom.has(x.parentId) && !inBoom.has(x.id)) {
        inBoom.add(x.id);
        groei = true;
      }
    }
  }
  const contractRegels = resultaat.contracten.flatMap((k) =>
    k.regels
      .filter((r) => inBoom.has(r.categorieId))
      .map((r) => ({ contract: k, regel: r })),
  );
  const contracten = [
    ...new Map(contractRegels.map((x) => [x.contract.id, x.contract])).values(),
  ].map((k) => {
    const eigen = contractRegels.filter((x) => x.contract.id === k.id);
    return {
      id: k.id,
      titel: k.titel,
      status: k.status,
      gecontracteerd: eigen.reduce((a, x) => a + x.regel.gecontracteerd, 0),
      prognose: eigen.reduce((a, x) => a + x.regel.prognose, 0),
    };
  });
  const openOffertes = offertes.filter(
    (o) =>
      o.status === "ontvangen" &&
      o.regels.some((r) => r.categorieId && inBoom.has(r.categorieId)),
  ).length;
  const controle = cat.afgesloten
    ? null
    : controleerAfsluiten(invoer, id, { vandaag });

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Kruimelpad */}
      <nav
        aria-label="Kruimelpad"
        className="text-muted flex flex-wrap items-center gap-1 text-sm"
      >
        <Link href="/budget" className="hover:text-foreground">
          Budget
        </Link>
        {pad.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            <Link href={`/budget/${p.id}`} className="hover:text-foreground">
              {p.naam}
            </Link>
          </span>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
          {cat.naam}
        </h1>
        {cat.afgesloten ? (
          <StatusPill soort="neutraal" icon={Lock}>
            Afgesloten
          </StatusPill>
        ) : (
          <StatusPill soort="info" icon={LockOpen}>
            Open
          </StatusPill>
        )}
        {!cat.isBlad && (
          <StatusPill soort="neutraal">Hoofdcategorie</StatusPill>
        )}
      </div>

      <section
        aria-label="Kerncijfers"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
      >
        <Cijfer label="Budget" waarde={c.budget} />
        <Cijfer label="Vastgelegd" waarde={c.vastgelegd} />
        <Cijfer
          label="Prognose"
          waarde={c.prognose}
          extra={<Afwijking bedrag={c.afwijking} />}
        />
        <Cijfer
          label="Betaald"
          waarde={c.betaald}
          extra={
            <span className="text-muted text-xs">
              van {formatEuro(c.gefactureerd, heel)} gefactureerd
            </span>
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="min-w-0 space-y-4 lg:col-span-7 lg:space-y-5">
          {/* Budgetregels (alleen bij eindcategorieën) */}
          {cat.isBlad && (
            <Card
              aria-labelledby="budgetregels-titel"
              className="overflow-hidden"
            >
              <CardHeader
                id="budgetregels-titel"
                title="Budget"
                description="Verdeel het budget eventueel over meerdere regels. Bedragen incl. BTW."
                className="pb-4"
              />
              <BudgetRegels
                categorieId={id}
                regels={budgetRegels}
                magBewerken={magBewerken}
              />
            </Card>
          )}

          {/* Contracten in deze categorie */}
          <Card aria-labelledby="contracten-titel" className="overflow-hidden">
            <CardHeader
              id="contracten-titel"
              title="Contracten"
              description={
                contracten.length
                  ? "Bedragen van de regels in deze categorie."
                  : "Nog geen contracten in deze categorie."
              }
              className="pb-4"
            />
            {contracten.length > 0 && (
              <ul>
                {contracten.map((k) => (
                  <li key={k.id} className="border-border border-t">
                    <Link
                      href={`/contracten/${k.id}`}
                      className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3 sm:px-6"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {k.titel}
                      </span>
                      {k.status !== "actief" && (
                        <StatusPill soort={STATUS_CONTRACT[k.status].soort}>
                          {STATUS_CONTRACT[k.status].tekst}
                        </StatusPill>
                      )}
                      <span className="text-muted hidden text-xs tabular-nums sm:inline">
                        gecontracteerd {formatEuro(k.gecontracteerd, heel)}
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {formatEuro(k.prognose, heel)}
                      </span>
                      <ChevronRight className="text-subtle size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {openOffertes > 0 && (
              <p className="border-border text-muted border-t px-5 py-3 text-sm sm:px-6">
                {openOffertes === 1
                  ? "Er wacht 1 offerte"
                  : `Er wachten ${openOffertes} offertes`}{" "}
                op een besluit.{" "}
                <Link
                  href="/offertes?weergave=vergelijk"
                  className="text-accent-ink font-medium hover:underline"
                >
                  Vergelijken
                </Link>
              </p>
            )}
          </Card>

          {/* Subcategorieën */}
          {(kinderen.length > 0 || magSubcategorie) && (
            <Card aria-labelledby="sub-titel" className="overflow-hidden">
              <CardHeader
                id="sub-titel"
                title="Subcategorieën"
                description={
                  kinderen.length
                    ? "Deze hoofdcategorie telt de bedragen van haar subcategorieën op."
                    : "Splits deze categorie op. Het budget geef je daarna per subcategorie op."
                }
                className="pb-4"
              />
              {kinderen.length > 0 && (
                <ul>
                  {kinderen.map((k) => (
                    <li key={k.id} className="border-border border-t">
                      <Link
                        href={`/budget/${k.id}`}
                        className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3 sm:px-6"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                          <span className="truncate">{k.naam}</span>
                          {k.afgesloten && (
                            <Lock
                              className="text-subtle size-3.5 shrink-0"
                              aria-label="Afgesloten"
                            />
                          )}
                        </span>
                        <span className="text-muted hidden text-xs tabular-nums sm:inline">
                          budget {formatEuro(k.cijfers.budget, heel)}
                        </span>
                        <span className="text-sm font-medium tabular-nums">
                          {formatEuro(k.cijfers.prognose, heel)}
                        </span>
                        <ChevronRight className="text-subtle size-4" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {magSubcategorie && (
                <div className="border-border border-t px-5 py-4 sm:px-6">
                  <CategorieToevoegenFormulier
                    parentId={id}
                    label="Nieuwe subcategorie"
                    knop="Toevoegen"
                  />
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5 lg:space-y-5">
          {/* Afsluiten */}
          <Card aria-labelledby="afsluiten-titel">
            <CardHeader
              id="afsluiten-titel"
              title={cat.afgesloten ? "Afgesloten" : "Categorie afsluiten"}
              description={
                cat.afgesloten
                  ? "De prognose is gelijk aan wat werkelijk is vastgelegd."
                  : "Zolang de categorie open is, is de prognose minimaal het budget. Sluit af als er niets meer bij komt; een meevaller wordt dan zichtbaar."
              }
            />
            <div className="space-y-4 px-5 pt-4 pb-5 sm:px-6">
              {cat.eigenAfgesloten && (
                <>
                  <p className="text-sm">
                    {rij?.closed_at
                      ? `Afgesloten op ${formatDatum(rij.closed_at)}`
                      : "Afgesloten"}
                    {afgeslotenDoor ? ` door ${afgeslotenDoor}` : ""}.
                  </p>
                  {magBewerken && (
                    <form action={categorieHeropenen}>
                      <input type="hidden" name="id" value={id} />
                      <button
                        type="submit"
                        className={knopKlassen("secundair")}
                      >
                        <LockOpen className="size-4" />
                        Heropenen
                      </button>
                    </form>
                  )}
                </>
              )}
              {cat.afgesloten && !cat.eigenAfgesloten && geslotenOuder && (
                <p className="text-sm">
                  Afgesloten via de hoofdcategorie{" "}
                  <Link
                    href={`/budget/${geslotenOuder.id}`}
                    className="text-accent-ink font-medium hover:underline"
                  >
                    {geslotenOuder.naam}
                  </Link>
                  .
                </p>
              )}
              {controle && (
                <>
                  <dl className="bg-surface-2 grid grid-cols-2 gap-3 rounded-xl p-4 text-sm tabular-nums">
                    <div>
                      <dt className="text-muted text-xs">Prognose nu</dt>
                      <dd className="mt-0.5 font-medium">
                        {formatEuro(controle.prognoseNu, heel)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted text-xs">Na afsluiten</dt>
                      <dd className="mt-0.5 font-medium">
                        {formatEuro(controle.prognoseNaAfsluiten, heel)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted text-xs">
                        Ten opzichte van het budget
                      </dt>
                      <dd className="mt-1 flex flex-wrap items-center gap-2">
                        <Afwijking bedrag={controle.afwijkingNaAfsluiten} />
                        <span className="text-muted text-xs">
                          {controle.afwijkingNaAfsluiten < 0
                            ? "meevaller na afsluiten"
                            : controle.afwijkingNaAfsluiten > 0
                              ? "overschrijding na afsluiten"
                              : "precies volgens budget"}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  {controle.waarschuwingen.length > 0 ? (
                    <ul className="space-y-2" aria-label="Waarschuwingen">
                      {controle.waarschuwingen.map((w) => (
                        <li
                          key={w.code}
                          className="bg-warning-soft text-warning flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
                        >
                          <TriangleExclamationPoint className="mt-0.5 size-4 shrink-0" />
                          {w.tekst}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted text-sm">
                      Er staat niets meer open in deze categorie.
                    </p>
                  )}
                  {c.vastgelegd === 0 && c.budget > 0 && (
                    <p className="border-warning/30 text-warning rounded-xl border px-3 py-2.5 text-sm">
                      Let op: in deze categorie is nog niets vastgelegd. Na
                      afsluiten telt het budget van {formatEuro(c.budget, heel)}{" "}
                      niet meer mee in de prognose.
                    </p>
                  )}
                  {magBewerken && (
                    <AfsluitFormulier
                      id={id}
                      metWaarschuwingen={controle.waarschuwingen.length > 0}
                    />
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Beheer */}
          {magBewerken && (
            <Card aria-labelledby="beheer-titel">
              <CardHeader id="beheer-titel" title="Beheer" />
              <div className="space-y-5 px-5 pt-4 pb-5 sm:px-6">
                <HernoemFormulier id={id} naam={cat.naam} />
                {broers.length > 1 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Volgorde</p>
                    <div className="flex gap-2">
                      {(["omhoog", "omlaag"] as const).map((richting) => (
                        <form key={richting} action={categorieVerplaatsen}>
                          <input type="hidden" name="id" value={id} />
                          <input
                            type="hidden"
                            name="richting"
                            value={richting}
                          />
                          <button
                            type="submit"
                            disabled={
                              richting === "omhoog"
                                ? plek <= 0
                                : plek >= broers.length - 1
                            }
                            className={knopKlassen("secundair", "px-3 py-2")}
                          >
                            {richting === "omhoog" ? (
                              <ArrowUp className="size-4" />
                            ) : (
                              <ArrowDown className="size-4" />
                            )}
                            {richting === "omhoog" ? "Omhoog" : "Omlaag"}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border-border border-t pt-5">
                  {kinderen.length > 0 ? (
                    <p className="text-muted text-sm">
                      Verwijderen kan pas als deze hoofdcategorie geen
                      subcategorieën meer heeft.
                    </p>
                  ) : heeftKosten ? (
                    <p className="text-muted text-sm">
                      Aan deze categorie zijn contracten of kosten gekoppeld;
                      verwijderen kan niet.
                    </p>
                  ) : (
                    <VerwijderFormulier id={id} naam={cat.naam} />
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
