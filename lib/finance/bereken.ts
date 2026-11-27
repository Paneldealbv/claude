/**
 * De rekenlogica van het Nieuwbouw Dashboard (docs/ARCHITECTUUR.md § 3).
 *
 * Eén pure functie: dezelfde invoer geeft altijd dezelfde uitkomst. Alle
 * schermen, rapportages en exports gebruiken deze uitkomst, zodat de cijfers
 * overal gelijk zijn.
 *
 * Volgorde:
 *  1. C(l) per contractregel (contract + goedgekeurd meer-/minderwerk)
 *  2. elke kostenregel wordt opgesplitst in "delen" per contractregel of
 *     categorie (termijnfacturen naar rato over de contractregels)
 *  3. betalingen worden naar rato over de delen van hun document verdeeld
 *  4. F(l), P(l) per contractregel → per contract
 *  5. eigen cijfers per categorie → R, prognose → optellen in de boom
 *  6. projecttotalen, financiering, ruimtes, termijnen, documenten
 */
import type {
  BronResultaat,
  CategorieInvoer,
  CategorieResultaat,
  Cent,
  Cijfers,
  ContractRegelInvoer,
  ContractResultaat,
  DocumentResultaat,
  FinancieringResultaat,
  Melding,
  ProjectInvoer,
  ProjectResultaat,
  RuimteResultaat,
  TermijnResultaat,
} from "./types";
import { som, verdeel } from "./verdeel";

export type BerekenOpties = {
  /** Datum van vandaag (JJJJ-MM-DD), voor vervaldatums. */
  vandaag: string;
};

/** Een deel van een kostenregel, toegewezen aan een contractregel of categorie. */
export type Deel = {
  kostenRegelId: string;
  documentId: string;
  geboekt: boolean;
  inControle: boolean;
  contractRegelId: string | null;
  categorieId: string | null;
  bedrag: Cent;
  /** Betaald deel (alleen bij geboekte documenten). */
  betaald: Cent;
};

/** Tussenresultaten die ook de afsluitcontrole gebruikt. */
export type Intern = {
  delen: Deel[];
  C: Map<string, Cent>;
  F: Map<string, Cent>;
  P: Map<string, Cent>;
  nogTeFactureren: Map<string, Cent>;
  voorgesteld: Map<string, Cent>;
  subboom: (categorieId: string) => Set<string>;
};

export const leegCijfers = (): Cijfers => ({
  budget: 0,
  gecontracteerd: 0,
  gefactureerd: 0,
  betaald: 0,
  openstaand: 0,
  vastgelegd: 0,
  nogNietVastgelegd: 0,
  prognose: 0,
  afwijking: 0,
  nogTeFactureren: 0,
  voorgesteldeWijzigingen: 0,
  inControle: 0,
});

export function telOp(a: Cijfers, b: Cijfers): Cijfers {
  const uit = leegCijfers();
  for (const k of Object.keys(uit) as (keyof Cijfers)[]) uit[k] = a[k] + b[k];
  return uit;
}

function plus<K>(map: Map<K, Cent>, sleutel: K, bedrag: Cent) {
  map.set(sleutel, (map.get(sleutel) ?? 0) + bedrag);
}

function groepeer<T, K>(
  items: readonly T[],
  sleutel: (t: T) => K,
): Map<K, T[]> {
  const uit = new Map<K, T[]>();
  for (const item of items) {
    const k = sleutel(item);
    const lijst = uit.get(k);
    if (lijst) lijst.push(item);
    else uit.set(k, [item]);
  }
  return uit;
}

const vergelijkNaam = (a: { naam: string }, b: { naam: string }) =>
  a.naam.localeCompare(b.naam, "nl");

function dagenTussen(van: string, tot: string): number {
  return Math.round(
    (Date.parse(`${tot}T00:00:00Z`) - Date.parse(`${van}T00:00:00Z`)) /
      86_400_000,
  );
}

// =============================================================================

export function berekenProject(
  invoer: ProjectInvoer,
  opties: BerekenOpties,
): ProjectResultaat {
  return bereken(invoer, opties).resultaat;
}

export function bereken(
  invoer: ProjectInvoer,
  opties: BerekenOpties,
): { resultaat: ProjectResultaat; intern: Intern } {
  const meldingen: Melding[] = [];
  const contractPerId = new Map(invoer.contracten.map((c) => [c.id, c]));
  const contractRegelPerId = new Map(
    invoer.contractRegels.map((r) => [r.id, r]),
  );
  const regelsPerContract = groepeer(
    invoer.contractRegels,
    (r) => r.contractId,
  );
  const documentPerId = new Map(invoer.documenten.map((d) => [d.id, d]));
  const categoriePerId = new Map(invoer.categorieen.map((c) => [c.id, c]));

  // ---------------------------------------------------------------------------
  // 1. C(l): contractregel + goedgekeurd meer-/minderwerk
  // ---------------------------------------------------------------------------
  const akkoord = new Map<string, Cent>();
  const voorgesteld = new Map<string, Cent>();
  for (const w of invoer.wijzigingen) {
    if (w.status === "akkoord") plus(akkoord, w.contractRegelId, w.bedrag);
    if (w.status === "voorgesteld")
      plus(voorgesteld, w.contractRegelId, w.bedrag);
  }
  const C = new Map<string, Cent>();
  for (const r of invoer.contractRegels) {
    const contract = contractPerId.get(r.contractId);
    const geannuleerd = contract?.status === "geannuleerd";
    C.set(r.id, geannuleerd ? 0 : r.bedrag + (akkoord.get(r.id) ?? 0));
  }

  // ---------------------------------------------------------------------------
  // 2. Kostenregels → delen
  // ---------------------------------------------------------------------------
  const delen: Deel[] = [];
  const zonderCategorie: string[] = [];
  const contractZonderRegels = new Set<string>();

  for (const kr of invoer.kostenRegels) {
    const doc = documentPerId.get(kr.documentId);
    if (!doc || doc.status === "vervallen") continue;
    const basis = {
      kostenRegelId: kr.id,
      documentId: kr.documentId,
      geboekt: doc.status === "geboekt",
      inControle: doc.status === "concept" || doc.status === "te_controleren",
      betaald: 0,
    };
    const los = () => {
      if (!kr.categorieId) zonderCategorie.push(kr.id);
      delen.push({
        ...basis,
        contractRegelId: null,
        categorieId: kr.categorieId,
        bedrag: kr.bedrag,
      });
    };

    const regel = kr.contractRegelId
      ? contractRegelPerId.get(kr.contractRegelId)
      : undefined;
    if (regel) {
      delen.push({
        ...basis,
        contractRegelId: regel.id,
        categorieId: regel.categorieId,
        bedrag: kr.bedrag,
      });
    } else if (kr.contractId) {
      let kandidaten: ContractRegelInvoer[] =
        regelsPerContract.get(kr.contractId) ?? [];
      if (kr.categorieId) {
        const zelfde = kandidaten.filter(
          (r) => r.categorieId === kr.categorieId,
        );
        if (zelfde.length) kandidaten = zelfde;
      }
      if (!kandidaten.length) {
        contractZonderRegels.add(kr.contractId);
        los();
      } else {
        const bedragen = verdeel(
          kr.bedrag,
          kandidaten.map((r) => Math.max(0, C.get(r.id) ?? 0)),
        );
        kandidaten.forEach((r, i) =>
          delen.push({
            ...basis,
            contractRegelId: r.id,
            categorieId: r.categorieId,
            bedrag: bedragen[i],
          }),
        );
      }
    } else {
      los();
    }
  }

  if (zonderCategorie.length) {
    meldingen.push({
      soort: "waarschuwing",
      code: "kostenregel_zonder_categorie",
      tekst: "Er zijn kostenregels zonder categorie of contract.",
      ids: zonderCategorie,
    });
  }
  if (contractZonderRegels.size) {
    meldingen.push({
      soort: "waarschuwing",
      code: "contract_zonder_regels",
      tekst: "Er zijn kosten gekoppeld aan een contract zonder contractregels.",
      ids: [...contractZonderRegels],
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Betalingen naar rato over de delen van hun document
  // ---------------------------------------------------------------------------
  const geboekteBetalingen = invoer.betalingen.filter(
    (b) => documentPerId.get(b.documentId)?.status === "geboekt",
  );
  const betaaldPerDocument = new Map<string, Cent>();
  for (const b of geboekteBetalingen)
    plus(betaaldPerDocument, b.documentId, b.bedrag);

  const delenPerDocument = groepeer(delen, (d) => d.documentId);
  let betaaldZonderDelen = 0;
  for (const [documentId, betaald] of betaaldPerDocument) {
    const docDelen = delenPerDocument.get(documentId) ?? [];
    if (!docDelen.length) {
      betaaldZonderDelen += betaald;
      continue;
    }
    verdeel(
      betaald,
      docDelen.map((d) => d.bedrag),
    ).forEach((b, i) => {
      docDelen[i].betaald = b;
    });
  }

  // ---------------------------------------------------------------------------
  // 4. F(l), P(l) en betaald per contractregel
  // ---------------------------------------------------------------------------
  const F = new Map<string, Cent>();
  const betaaldPerRegel = new Map<string, Cent>();
  for (const d of delen) {
    if (!d.geboekt || !d.contractRegelId) continue;
    plus(F, d.contractRegelId, d.bedrag);
    plus(betaaldPerRegel, d.contractRegelId, d.betaald);
  }
  const P = new Map<string, Cent>();
  const nogTeFactureren = new Map<string, Cent>();
  for (const r of invoer.contractRegels) {
    const actief = contractPerId.get(r.contractId)?.status === "actief";
    const c = C.get(r.id) ?? 0;
    const f = F.get(r.id) ?? 0;
    // Actief: het grootste van afspraak en factuur. Afgerond of geannuleerd:
    // alleen wat werkelijk gefactureerd is.
    P.set(r.id, actief ? Math.max(c, f) : f);
    nogTeFactureren.set(r.id, actief ? Math.max(0, c - f) : 0);
  }

  // ---------------------------------------------------------------------------
  // 5. Eigen cijfers per categorie (en "onverdeeld")
  // ---------------------------------------------------------------------------
  const eigen = new Map<string, Cijfers>();
  const onverdeeld = leegCijfers();
  const cijfersVan = (categorieId: string | null): Cijfers => {
    if (!categorieId || !categoriePerId.has(categorieId)) return onverdeeld;
    let c = eigen.get(categorieId);
    if (!c) eigen.set(categorieId, (c = leegCijfers()));
    return c;
  };
  const inControleDocs = new Map<string, Set<string>>();

  for (const b of invoer.budgetRegels)
    cijfersVan(b.categorieId).budget += b.bedrag;

  for (const r of invoer.contractRegels) {
    const c = cijfersVan(r.categorieId);
    c.gecontracteerd += C.get(r.id) ?? 0;
    c.vastgelegd += P.get(r.id) ?? 0;
    c.nogTeFactureren += nogTeFactureren.get(r.id) ?? 0;
    c.voorgesteldeWijzigingen += voorgesteld.get(r.id) ?? 0;
  }

  for (const d of delen) {
    const c = cijfersVan(d.categorieId);
    if (d.geboekt) {
      c.gefactureerd += d.bedrag;
      c.betaald += d.betaald;
      // Kosten zonder contract tellen direct als vastgelegd; kosten op een
      // contract zitten al in P(l) (geen dubbeltelling).
      if (!d.contractRegelId) c.vastgelegd += d.bedrag;
    } else if (d.inControle) {
      c.inControle += d.bedrag;
      if (d.categorieId) {
        const set = inControleDocs.get(d.categorieId) ?? new Set<string>();
        set.add(d.documentId);
        inControleDocs.set(d.categorieId, set);
      }
    }
  }
  onverdeeld.betaald += betaaldZonderDelen;

  // ---------------------------------------------------------------------------
  // 6. Boom: afgesloten, R en prognose per categorie, optellen naar boven
  // ---------------------------------------------------------------------------
  const kinderenVan = groepeer(
    invoer.categorieen.filter(
      (c) => c.parentId && categoriePerId.has(c.parentId),
    ),
    (c) => c.parentId as string,
  );
  const wortels = invoer.categorieen.filter(
    (c) => !c.parentId || !categoriePerId.has(c.parentId),
  );
  const sorteer = (lijst: CategorieInvoer[]) =>
    [...lijst].sort((a, b) => a.volgorde - b.volgorde || vergelijkNaam(a, b));

  const afronden = (c: Cijfers, afgesloten: boolean) => {
    c.openstaand = c.gefactureerd - c.betaald;
    c.nogNietVastgelegd = afgesloten ? 0 : Math.max(0, c.budget - c.vastgelegd);
    c.prognose = c.vastgelegd + c.nogNietVastgelegd;
    c.afwijking = c.prognose - c.budget;
  };
  afronden(onverdeeld, true);

  const categorieen: CategorieResultaat[] = [];
  const totaalPerCategorie = new Map<string, Cijfers>();
  const docsInSubboom = new Map<string, Set<string>>();
  const kostenZonderBudget: string[] = [];

  const loop = (
    cat: CategorieInvoer,
    diepte: number,
    ouderAfgesloten: boolean,
    bezocht: Set<string>,
  ): Cijfers => {
    bezocht.add(cat.id);
    const afgesloten = ouderAfgesloten || cat.afgesloten;
    const e = cijfersVan(cat.id);
    afronden(e, afgesloten);
    const kinderen = sorteer(kinderenVan.get(cat.id) ?? []).filter(
      (k) => !bezocht.has(k.id),
    );
    if (!kinderen.length && e.budget === 0 && e.vastgelegd > 0)
      kostenZonderBudget.push(cat.id);

    const index = categorieen.length;
    categorieen.push(undefined as unknown as CategorieResultaat); // plek in boomvolgorde
    let totaal = { ...e };
    const docs = new Set(inControleDocs.get(cat.id) ?? []);
    for (const kind of kinderen) {
      totaal = telOp(totaal, loop(kind, diepte + 1, afgesloten, bezocht));
      for (const d of docsInSubboom.get(kind.id) ?? []) docs.add(d);
    }
    totaalPerCategorie.set(cat.id, totaal);
    docsInSubboom.set(cat.id, docs);
    categorieen[index] = {
      id: cat.id,
      naam: cat.naam,
      parentId:
        cat.parentId && categoriePerId.has(cat.parentId) ? cat.parentId : null,
      diepte,
      isBlad: kinderen.length === 0,
      afgesloten,
      eigenAfgesloten: cat.afgesloten,
      cijfers: totaal,
      documentenInControle: docs.size,
    };
    return totaal;
  };

  const bezocht = new Set<string>();
  let cijfers = { ...onverdeeld };
  for (const w of sorteer(wortels))
    cijfers = telOp(cijfers, loop(w, 0, false, bezocht));
  // Vangnet: categorieën in een kring (kan door de database niet ontstaan).
  for (const c of sorteer(invoer.categorieen)) {
    if (!bezocht.has(c.id))
      cijfers = telOp(cijfers, loop(c, 0, false, bezocht));
  }

  if (kostenZonderBudget.length) {
    meldingen.push({
      soort: "info",
      code: "kosten_zonder_budget",
      tekst: "Er zijn kosten in categorieën zonder budget.",
      ids: kostenZonderBudget,
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Documenten
  // ---------------------------------------------------------------------------
  const totaalPerDocument = new Map<string, Cent>();
  for (const kr of invoer.kostenRegels)
    plus(totaalPerDocument, kr.documentId, kr.bedrag);

  const overbetaald: string[] = [];
  const documenten: DocumentResultaat[] = invoer.documenten.map((d) => {
    const totaal = totaalPerDocument.get(d.id) ?? 0;
    const betaald =
      d.status === "geboekt" ? (betaaldPerDocument.get(d.id) ?? 0) : 0;
    const openstaand = totaal - betaald;
    if (
      Math.abs(betaald) > Math.abs(totaal) ||
      (betaald !== 0 && Math.sign(betaald) !== Math.sign(totaal))
    ) {
      overbetaald.push(d.id);
    }
    const dagen = d.vervalDatum
      ? dagenTussen(opties.vandaag, d.vervalDatum)
      : null;
    let betaalStatus: DocumentResultaat["betaalStatus"] = null;
    if (d.status === "geboekt") {
      if (openstaand === 0) betaalStatus = "betaald";
      else if (dagen !== null && dagen < 0) betaalStatus = "te_laat";
      else if (betaald !== 0) betaalStatus = "deels";
      else betaalStatus = "open";
    }
    return {
      id: d.id,
      type: d.type,
      status: d.status,
      totaal,
      betaald,
      openstaand,
      betaalStatus,
      vervalDatum: d.vervalDatum,
      dagenTotVervallen: dagen,
    };
  });
  if (overbetaald.length) {
    meldingen.push({
      soort: "waarschuwing",
      code: "overbetaald",
      tekst: "Er is meer betaald dan het totaal van een document.",
      ids: overbetaald,
    });
  }

  // ---------------------------------------------------------------------------
  // 8. Contracten en termijnen
  // ---------------------------------------------------------------------------
  const termijnenPerContract = groepeer(invoer.termijnen, (t) => t.contractId);
  const gefactureerdPerTermijn = new Map<string, Cent>();
  for (const d of invoer.documenten) {
    if (d.status === "geboekt" && d.termijnId) {
      plus(
        gefactureerdPerTermijn,
        d.termijnId,
        totaalPerDocument.get(d.id) ?? 0,
      );
    }
  }

  const contracten: ContractResultaat[] = invoer.contracten.map((contract) => {
    const regels = (regelsPerContract.get(contract.id) ?? []).map((r) => ({
      id: r.id,
      categorieId: r.categorieId,
      omschrijving: r.omschrijving,
      gecontracteerd: C.get(r.id) ?? 0,
      gefactureerd: F.get(r.id) ?? 0,
      prognose: P.get(r.id) ?? 0,
      betaald: betaaldPerRegel.get(r.id) ?? 0,
      nogTeFactureren: nogTeFactureren.get(r.id) ?? 0,
      voorgesteldeWijzigingen: voorgesteld.get(r.id) ?? 0,
    }));
    const gecontracteerd = som(regels.map((r) => r.gecontracteerd));
    const prognose = som(regels.map((r) => r.prognose));

    const termijnInvoer = [
      ...(termijnenPerContract.get(contract.id) ?? []),
    ].sort((a, b) => a.volgorde - b.volgorde);
    const percentages = termijnInvoer.map((t) =>
      t.bedrag === null ? (t.percentageBp ?? 0) : 0,
    );
    const somPct = som(percentages);
    const uitPct = verdeel(gecontracteerd, [
      ...percentages,
      Math.max(0, 10_000 - somPct),
    ]);
    const termijnen: TermijnResultaat[] = termijnInvoer.map((t, i) => {
      const verwachtBedrag = t.bedrag ?? uitPct[i];
      const gefactureerd = gefactureerdPerTermijn.get(t.id) ?? 0;
      return {
        id: t.id,
        volgorde: t.volgorde,
        omschrijving: t.omschrijving,
        verwachtBedrag,
        verwachteDatum: t.verwachteDatum,
        gefactureerd,
        status:
          gefactureerd === 0
            ? "open"
            : Math.abs(gefactureerd) >= Math.abs(verwachtBedrag)
              ? "gefactureerd"
              : "deels",
      };
    });

    return {
      id: contract.id,
      titel: contract.titel,
      status: contract.status,
      regels,
      gecontracteerd,
      gefactureerd: som(regels.map((r) => r.gefactureerd)),
      prognose,
      betaald: som(regels.map((r) => r.betaald)),
      nogTeFactureren: som(regels.map((r) => r.nogTeFactureren)),
      overschrijding: prognose - gecontracteerd,
      termijnen,
    };
  });

  // ---------------------------------------------------------------------------
  // 9. Financiering: delen (bouwdepot) tellen niet extra mee
  // ---------------------------------------------------------------------------
  const bronPerId = new Map(invoer.bronnen.map((b) => [b.id, b]));
  const betaaldPerBron = new Map<string, Cent>();
  let betaaldZonderBron = 0;
  for (const b of geboekteBetalingen) {
    if (b.bronId && bronPerId.has(b.bronId))
      plus(betaaldPerBron, b.bronId, b.bedrag);
    else betaaldZonderBron += b.bedrag;
  }
  const delenVan = groepeer(
    invoer.bronnen.filter((b) => b.parentId && bronPerId.has(b.parentId)),
    (b) => b.parentId as string,
  );
  const afwijkendeDelen: string[] = [];
  const bronnen: BronResultaat[] = invoer.bronnen
    .filter((b) => !b.parentId || !bronPerId.has(b.parentId))
    .map((b) => {
      const delenRes: BronResultaat[] = (delenVan.get(b.id) ?? []).map((d) => {
        const betaald = betaaldPerBron.get(d.id) ?? 0;
        return { ...d, betaald, saldo: d.bedrag - betaald, delen: [] };
      });
      if (delenRes.length && som(delenRes.map((d) => d.bedrag)) !== b.bedrag) {
        afwijkendeDelen.push(b.id);
      }
      const betaald =
        (betaaldPerBron.get(b.id) ?? 0) + som(delenRes.map((d) => d.betaald));
      return {
        ...b,
        parentId: null,
        betaald,
        saldo: b.bedrag - betaald,
        delen: delenRes,
      };
    });
  if (afwijkendeDelen.length) {
    meldingen.push({
      soort: "waarschuwing",
      code: "delen_wijken_af",
      tekst:
        "De delen van een hypotheek tellen niet op tot het hypotheekbedrag.",
      ids: afwijkendeDelen,
    });
  }
  const totaalBeschikbaar = som(bronnen.map((b) => b.bedrag));
  const financiering: FinancieringResultaat = {
    totaalBeschikbaar,
    bronnen,
    betaaldZonderBron,
    ruimte: totaalBeschikbaar - cijfers.prognose,
    beschikbaarNaBetalingen: totaalBeschikbaar - cijfers.betaald,
    nogTeBetalen: cijfers.prognose - cijfers.betaald,
  };

  // ---------------------------------------------------------------------------
  // 10. Ruimtes (los van categorieën; "niet toegewezen" vult aan tot 100%)
  // ---------------------------------------------------------------------------
  const ruimteIds = new Set(invoer.ruimtes.map((r) => r.id));
  const perKostenRegel = groepeer(
    invoer.ruimteVerdelingen.filter(
      (v) => v.kostenRegelId && ruimteIds.has(v.ruimteId),
    ),
    (v) => v.kostenRegelId as string,
  );
  const perContractRegel = groepeer(
    invoer.ruimteVerdelingen.filter(
      (v) => v.contractRegelId && ruimteIds.has(v.ruimteId),
    ),
    (v) => v.contractRegelId as string,
  );
  type Rij = Omit<RuimteResultaat, "id" | "naam">;
  const perRuimte = new Map<string | null, Rij>();
  const rij = (id: string | null) => {
    let r = perRuimte.get(id);
    if (!r)
      perRuimte.set(
        id,
        (r = { gecontracteerd: 0, gefactureerd: 0, betaald: 0, vastgelegd: 0 }),
      );
    return r;
  };
  const verdeelRuimtes = (
    bedrag: Cent,
    verdeling: { ruimteId: string; aandeelBp: number }[] | undefined,
    veld: keyof Rij,
  ) => {
    if (bedrag === 0) return;
    const lijst = verdeling ?? [];
    const toegewezen = som(lijst.map((v) => v.aandeelBp));
    const gewichten = [
      ...lijst.map((v) => v.aandeelBp),
      Math.max(0, 10_000 - toegewezen),
    ];
    verdeel(bedrag, gewichten).forEach((b, i) => {
      rij(i < lijst.length ? lijst[i].ruimteId : null)[veld] += b;
    });
  };
  for (const r of invoer.contractRegels) {
    verdeelRuimtes(
      C.get(r.id) ?? 0,
      perContractRegel.get(r.id),
      "gecontracteerd",
    );
    verdeelRuimtes(P.get(r.id) ?? 0, perContractRegel.get(r.id), "vastgelegd");
  }
  for (const d of delen) {
    if (!d.geboekt) continue;
    // Eigen verdeling van de kostenregel gaat voor; anders die van de contractregel.
    const verdeling =
      perKostenRegel.get(d.kostenRegelId) ??
      (d.contractRegelId ? perContractRegel.get(d.contractRegelId) : undefined);
    verdeelRuimtes(d.bedrag, verdeling, "gefactureerd");
    verdeelRuimtes(d.betaald, verdeling, "betaald");
    if (!d.contractRegelId) verdeelRuimtes(d.bedrag, verdeling, "vastgelegd");
  }
  if (betaaldZonderDelen) rij(null).betaald += betaaldZonderDelen;

  const ruimtes: RuimteResultaat[] = [
    ...[...invoer.ruimtes]
      .sort((a, b) => a.volgorde - b.volgorde || vergelijkNaam(a, b))
      .map((r) => ({ id: r.id, naam: r.naam, ...rij(r.id) })),
    { id: null, naam: "Niet toegewezen", ...rij(null) },
  ];

  // ---------------------------------------------------------------------------
  // 11. Betalingen per maand
  // ---------------------------------------------------------------------------
  const perMaand = new Map<string, Cent>();
  for (const b of geboekteBetalingen)
    plus(perMaand, b.datum.slice(0, 7), b.bedrag);
  const betalingenPerMaand = [...perMaand.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([maand, bedrag]) => ({ maand, bedrag }));

  // ---------------------------------------------------------------------------
  const subboom = (categorieId: string) => {
    const uit = new Set<string>();
    const stapel = [categorieId];
    while (stapel.length) {
      const id = stapel.pop() as string;
      if (uit.has(id)) continue;
      uit.add(id);
      for (const k of kinderenVan.get(id) ?? []) stapel.push(k.id);
    }
    return uit;
  };

  return {
    resultaat: {
      cijfers,
      onverdeeld,
      categorieen,
      contracten,
      documenten,
      financiering,
      ruimtes,
      betalingenPerMaand,
      meldingen,
    },
    intern: { delen, C, F, P, nogTeFactureren, voorgesteld, subboom },
  };
}
