import "server-only";
import { cache } from "react";
import { getLeden } from "@/lib/auth";
import {
  dashboardUitResultaat,
  type ActiviteitItem,
  type ControleItem,
  type DocumentInfo,
} from "@/lib/dashboard";
import { formatDatum } from "@/lib/format";
import { DOCUMENT_TYPE, STATUS_CONTRACT, STATUS_DOCUMENT } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { isGeldigeIsoDatum } from "@/lib/datum";
import { documentOverzicht } from "./documenten";
import { laadVoorstellen, type VoorstelRij } from "./herkenning";
import { laadProjectResultaat } from "./project";

const TIJD = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Amsterdam",
});
// en-CA geeft JJJJ-MM-DD; in de tijdzone van het project.
const DAG = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" });

function dagErvoor(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function wanneer(tijdstip: string, vandaag: string) {
  const moment = new Date(tijdstip);
  const dag = DAG.format(moment);
  const tijd = TIJD.format(moment);
  if (dag === vandaag) return `vandaag, ${tijd}`;
  if (dag === dagErvoor(vandaag)) return `gisteren, ${tijd}`;
  return formatDatum(dag);
}

const PUNT_LABEL = {
  ontbreekt: "Ontbreekt",
  "klopt-niet": "Klopt niet",
  onzeker: "Onzeker",
} as const;

/** Een AI-voorstel als regel in "Te controleren", met de punten samengevat. */
function voorstelItem(v: VoorstelRij): ControleItem {
  const soort = v.soort ? DOCUMENT_TYPE[v.soort].tekst : "AI-voorstel";
  const datum =
    v.datum && isGeldigeIsoDatum(v.datum) ? formatDatum(v.datum) : null;
  let punten: ControleItem["punten"];
  if (v.vastgelopen || v.status === "mislukt") {
    punten = [{ soort: "status", tekst: "Uitlezen niet gelukt" }];
  } else if (v.status === "bezig" || v.status === "wachtrij") {
    punten = [{ soort: "status", tekst: "Wordt uitgelezen" }];
  } else {
    const telling = new Map<keyof typeof PUNT_LABEL, number>();
    let dubbel = false;
    for (const p of v.punten) {
      if (p.soort === "duplicaat") dubbel = true;
      else telling.set(p.soort, (telling.get(p.soort) ?? 0) + 1);
    }
    punten = [
      ...(dubbel
        ? [{ soort: "duplicaat" as const, tekst: "Mogelijk dubbel" }]
        : []),
      ...[...telling].map(([s, n]) => ({
        soort: s,
        tekst: `${PUNT_LABEL[s]}: ${n}`,
      })),
    ];
    if (!punten.length) {
      punten = [{ soort: "status", tekst: "AI-voorstel, klaar om te boeken" }];
    }
  }
  return {
    id: v.id,
    titel: [`${soort}${v.nummer ? ` ${v.nummer}` : ""}`, datum]
      .filter(Boolean)
      .join(" · "),
    leverancier: v.leverancier ?? v.bestand.naam,
    bedrag:
      v.totaal === null
        ? null
        : v.soort === "creditnota"
          ? -v.totaal
          : v.totaal,
    punten,
    href: `/te-controleren/${v.id}`,
  };
}

/** Alles voor het dashboard van het actieve project. */
export const laadDashboard = cache(async (projectId: string) => {
  const supabase = await createClient();
  const [{ invoer, resultaat, vandaag }, documenten, leden, log, voorstellen] =
    await Promise.all([
      laadProjectResultaat(projectId),
      documentOverzicht(projectId),
      getLeden(projectId),
      supabase
        .from("activity_log")
        .select("id, user_id, action, record_id, changes, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(8),
      laadVoorstellen(projectId),
    ]);

  const docPerId = new Map(documenten.map((d) => [d.id, d]));
  const info: DocumentInfo = Object.fromEntries(
    documenten.map((d) => [
      d.id,
      {
        leverancier: d.titel,
        omschrijving: `${DOCUMENT_TYPE[d.type].tekst} ${d.nummer ?? formatDatum(d.datum)}`,
      },
    ]),
  );
  const basis = dashboardUitResultaat(resultaat, info, { metLinks: true });

  // AI-voorstellen eerst (die wachten op controle), dan niet-geboekte documenten.
  const teControleren: ControleItem[] = voorstellen.map(voorstelItem);
  teControleren.push(
    ...documenten
      .filter((d) => d.status === "concept" || d.status === "te_controleren")
      .map((d): ControleItem => ({
        id: d.id,
        titel: `${DOCUMENT_TYPE[d.type].tekst}${d.nummer ? ` ${d.nummer}` : ""} · ${formatDatum(d.datum)}`,
        leverancier: d.titel,
        bedrag: d.totaal,
        punten: [{ soort: "status", tekst: STATUS_DOCUMENT[d.status].tekst }],
        href: `/documenten/${d.id}`,
      })),
  );

  // Activiteit in gewone taal.
  const naam = new Map(leden.map((l) => [l.userId, l.naam]));
  const categorie = new Map(invoer.categorieen.map((c) => [c.id, c.naam]));
  const contract = new Map(invoer.contracten.map((c) => [c.id, c.titel]));
  const regelContract = new Map(
    invoer.contractRegels.map((r) => [r.id, r.contractId]),
  );
  const wijzigingContract = new Map(
    invoer.wijzigingen.map((w) => [
      w.id,
      regelContract.get(w.contractRegelId) ?? null,
    ]),
  );
  const activiteit: ActiviteitItem[] = (log.data ?? []).map((a) => {
    const id = a.record_id ?? "";
    const c = (a.changes ?? {}) as Record<string, unknown>;
    const doc = docPerId.get(id);
    const docNaam = doc
      ? `${DOCUMENT_TYPE[doc.type].tekst.toLowerCase()}${doc.nummer ? ` ${doc.nummer}` : ""}`
      : "een document";
    let wat: string = a.action.replaceAll("_", " ");
    let href: string | undefined;
    let bedrag: number | null = null;
    switch (a.action) {
      case "project_aangemaakt":
        wat = "heeft het project aangemaakt";
        break;
      case "lid_uitgenodigd":
        wat = `heeft ${String(c.email ?? "iemand")} uitgenodigd`;
        break;
      case "uitnodiging_geaccepteerd":
        wat = "is lid geworden van het project";
        break;
      case "categorie_afgesloten":
      case "categorie_heropend":
        wat = `heeft ${categorie.get(id) ?? "een categorie"} ${a.action === "categorie_afgesloten" ? "afgesloten" : "heropend"}`;
        href = categorie.has(id) ? `/budget/${id}` : undefined;
        break;
      case "offerte_geaccepteerd": {
        const cid = String(c.contract_id ?? "");
        wat = contract.has(cid)
          ? `heeft de offerte voor ${contract.get(cid)} geaccepteerd`
          : "heeft een offerte geaccepteerd";
        href = contract.has(cid) ? `/contracten/${cid}` : undefined;
        break;
      }
      case "contract_status": {
        const naar = String(c.naar ?? "") as keyof typeof STATUS_CONTRACT;
        wat = `heeft ${contract.get(id) ?? "een contract"} op ${STATUS_CONTRACT[naar]?.tekst.toLowerCase() ?? naar} gezet`;
        href = contract.has(id) ? `/contracten/${id}` : undefined;
        break;
      }
      case "contract_verwijderd":
        wat = `heeft contract ${String(c.titel ?? "")} verwijderd`;
        break;
      case "wijziging_besluit": {
        const naar = String(c.naar ?? "");
        wat =
          naar === "akkoord"
            ? "heeft meer-/minderwerk goedgekeurd"
            : naar === "afgewezen"
              ? "heeft meer-/minderwerk afgewezen"
              : "heeft een besluit over meer-/minderwerk teruggedraaid";
        const cid = wijzigingContract.get(id);
        href = cid ? `/contracten/${cid}` : undefined;
        break;
      }
      case "document_geboekt":
        wat = `heeft ${docNaam} geboekt`;
        bedrag = typeof c.totaal === "number" ? c.totaal : null;
        href = doc ? `/documenten/${id}` : undefined;
        break;
      case "document_concept":
        wat = `heeft ${docNaam} teruggezet naar concept`;
        href = doc ? `/documenten/${id}` : undefined;
        break;
      case "document_vervallen":
        wat = `heeft ${docNaam} laten vervallen`;
        href = doc ? `/documenten/${id}` : undefined;
        break;
      case "document_verwijderd":
        wat = "heeft een document verwijderd";
        break;
    }
    return {
      id: String(a.id),
      wie: (a.user_id && naam.get(a.user_id)) || "Iemand",
      wat,
      bedrag,
      wanneer: wanneer(a.created_at, vandaag),
      href,
    };
  });

  const stappen = [
    {
      tekst: "Zet je budget op",
      href: "/budget",
      klaar: resultaat.cijfers.budget > 0,
    },
    {
      tekst: "Voeg offertes toe en accepteer ze als contract",
      href: "/offertes",
      klaar: invoer.contracten.length > 0,
    },
    {
      tekst: "Voer facturen en bonnen in",
      href: "/documenten",
      klaar: documenten.length > 0,
    },
    {
      tekst: "Nodig je partner uit",
      href: "/instellingen",
      klaar: leden.length > 1,
    },
  ];

  return {
    resultaat,
    ...basis,
    teControleren,
    activiteit,
    stappen,
    aantalCategorieen: invoer.categorieen.filter(
      (c) => !invoer.categorieen.some((x) => x.parentId === c.id),
    ).length,
  };
});
