# Nieuwbouw Dashboard — Technische architectuur

Versie 6 · 26-11-2026 · fase 6: facturen, bonnen en betalingen (§ 3.13).

Dit document is de leidraad voor de bouw. Wijzigingen in het datamodel of de
rekenregels worden eerst hier vastgelegd en daarna pas gebouwd.

---

## 1. Uitgangspunten

| Onderwerp         | Keuze                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Taal              | Nederlands (alle schermen, meldingen en e-mails)                   |
| Valuta            | Euro; intern **altijd hele centen** (integer), nooit kommagetallen |
| Weergave bedragen | Standaard **inclusief BTW**                                        |
| Datumnotatie      | **DD-MM-JJJJ** (database slaat ISO `JJJJ-MM-DD` op)                |
| Tijdzone          | Europe/Amsterdam                                                   |
| Inloggen          | E-mail + wachtwoord (Supabase Auth), minimaal twee eigen accounts  |
| Apparaten         | Volledig responsive: desktop, laptop, tablet en telefoon           |
| Bouwdepot         | Zit in het datamodel; uitgebreide schermen volgen later            |

## 2. Techniek

```
 Telefoon / laptop (browser, PWA)
          │  HTTPS
          ▼
 ┌──────────────────────────┐        ┌────────────────────────────────┐
 │ Next.js 16 op Vercel     │◄──────►│ Supabase (EU, Frankfurt)       │
 │ - Server Components (UI) │        │ - Auth (accounts)              │
 │ - Server Actions (muta-  │        │ - Postgres + Row Level Security│
 │   ties, validatie)       │        │ - Storage (PDF's en foto's)    │
 │ - lib/finance (rekenen)  │        └────────────────────────────────┘
 │ - AI-herkenning ─────────┼──────► Claude API (alleen server-side)
 └──────────────────────────┘
```

| Onderdeel   | Keuze                                                                           | Toelichting                                                 |
| ----------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Framework   | Next.js 16 (App Router), React 19                                               | Schermen en serverlogica in één codebase                    |
| Taal        | TypeScript (strict)                                                             | Typefouten vallen op vóór ze een bedrag raken               |
| Styling     | Tailwind CSS 4 + shadcn/ui                                                      | Consistente, premium componenten                            |
| Grafieken   | Recharts                                                                        | Budget vs. prognose, uitgaven per maand                     |
| Formulieren | React Hook Form + Zod                                                           | Dezelfde validatie in browser en server                     |
| Database    | Supabase Postgres                                                               | Relaties en controles afgedwongen door de database          |
| Beveiliging | Row Level Security                                                              | Database controleert lidmaatschap per project               |
| Bestanden   | Supabase Storage, privé bucket                                                  | Elk origineel document één keer bewaard                     |
| AI          | Claude API (Claude Opus 5.5), PDF- en beeldinvoer, gestructureerde JSON-uitvoer | Alleen vanaf de server; de sleutel komt nooit in de browser |
| Tests       | Vitest                                                                          | Vooral voor alle rekenregels                                |
| Hosting     | Vercel + Supabase                                                               | Automatisch online na elke push, HTTPS                      |

### Mappenstructuur

```
app/
  (auth)/            inloggen, registreren, uitnodiging accepteren
  (app)/             alle schermen achter de login
components/          UI-componenten (kaarten, tabellen, grafieken, formulieren)
lib/
  format.ts          euro- en datumnotatie
  finance/           ALLE rekenlogica (pure functies + tests)
  supabase/          databaseverbinding (server en browser)
  validation/        Zod-schema's
  ai/                documentherkenning
supabase/
  migrations/        databasestructuur als SQL, onder versiebeheer
  seed.sql           voorbeelddata voor ontwikkeling
docs/                dit document
```

---

## 3. Het financiële model

### 3.1 Vier lagen, elk bedrag hoort bij precies één laag

Dubbeltelling ontstaat als hetzelfde geld op twee plaatsen wordt opgeteld.
Daarom heeft ieder bedrag in het systeem één vaste rol:

| Laag           | Tabel                                             | Rol in de berekening                                                                                       |
| -------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Plan**       | `budget_lines`                                    | Wat we van plan zijn uit te geven                                                                          |
| **Aanbod**     | `quotes`, `quote_lines`                           | **Telt nooit mee.** Een offerte is alleen informatie, tot ze wordt geaccepteerd                            |
| **Toezegging** | `contracts`, `contract_lines`, `contract_changes` | Wat we hebben afgesproken te betalen (geaccepteerde offerte of overeenkomst)                               |
| **Werkelijk**  | `cost_documents`, `cost_lines`                    | Wat daadwerkelijk in rekening is gebracht: facturen, termijnfacturen, eindfacturen, creditnota's en bonnen |
| **Betaald**    | `payments`                                        | Wat van onze rekening of uit het bouwdepot is afgeschreven                                                 |

```
 quotes ──(accepteren)──► contracts ──< contract_lines ──< contract_changes
                              │              │   (meer-/minderwerk)
                              │              └──< contract_installments (termijnschema)
                              │
                              ▼  (koppeling per regel)
 files ──1:1── cost_documents ──< cost_lines ──< room_allocations >── rooms
                    │                 │
                    │                 └── category (verplicht, of afgeleid van het contract)
                    └──< payments >── funding_sources ──< depot_claims
```

### 3.2 Koppelingen

- Een **geaccepteerde offerte** wordt een **contract** (opdracht). De offerteregels
  worden contractregels. Een contract kan ook zonder offerte bestaan, bijvoorbeeld
  de aanneemovereenkomst met de bouwer.
- Een **contractregel** hoort bij precies één (eind)categorie.
- Een **kostenregel** op een factuur of bon kan op drie manieren gekoppeld zijn:
  1. **aan een contractregel**: de categorie volgt automatisch uit de contractregel;
  2. **aan een heel contract**: typisch een termijnfactuur ("termijn 3: 10% van de
     aanneemsom"). Het bedrag wordt naar rato over de contractregels verdeeld;
  3. **los**, zonder contract (bijv. een IKEA-bon): de categorie is dan verplicht.
- Termijnfacturen en de eindfactuur verwijzen naar hetzelfde contract. Een
  termijnfactuur kan ook naar een termijn uit het termijnschema verwijzen, zodat we
  zien welke termijnen nog moeten komen.
- Een **betaling** hoort bij één document. Deelbetalingen zijn toegestaan, en de
  database weigert dat er meer betaald wordt dan het document groot is. Een bon
  krijgt automatisch een betaling op de bondatum.

### 3.3 Rekenregels per contract

Voor iedere contractregel `l`:

```
C(l) = bedrag contractregel + Σ goedgekeurd meer-/minderwerk op die regel
F(l) = Σ geboekte kostenregels direct op l
     + aandeel van kostenregels op contractniveau (naar rato van C)
P(l) = F(l)                als het contract is afgerond (eindafrekening ontvangen)
       max( C(l), F(l) )   anders
```

**Prognose van het contract = Σ P(l) over al zijn regels.**

Waarom per regel en niet per contract: stel een contract heeft regel A (€ 10.000)
en regel B (€ 5.000). Op A komt € 12.000 binnen (meerwerk), op B nog niets. Op
contractniveau geeft `max(15.000, 12.000)` maar € 15.000, terwijl B nog moet komen.
Per regel is het `12.000 + 5.000 = € 17.000`, en dat is juist. Een contract met één
regel komt gewoon uit op `max(contract, gefactureerd)`.

**Controlevoorbeeld (eis van de opdrachtgever):** offerte € 15.000 geaccepteerd en
drie termijnfacturen van € 5.000 gekoppeld aan het contract.

| Moment                                          | Gecontracteerd | Gefactureerd | Prognose                  |
| ----------------------------------------------- | -------------- | ------------ | ------------------------- |
| Na acceptatie                                   | 15.000         | 0            | **15.000**                |
| Na termijn 1                                    | 15.000         | 5.000        | **15.000**                |
| Na termijn 3                                    | 15.000         | 15.000       | **15.000** (nooit 30.000) |
| Eindfactuur +€ 800 meerwerk                     | 15.000         | 15.800       | **15.800**                |
| Contract afgerond met € 300 minderwerk (credit) | 15.000         | 14.700       | **14.700**                |

### 3.4 Rekenregels per categorie

Categorieën vormen een boom (bijv. _Afbouw → Keuken_). Budget en kosten hangen
**alleen aan eindcategorieën**. Bovenliggende categorieën zijn de som van hun
kinderen, zodat niets twee keer meetelt.

Per eindcategorie `c`:

| Begrip                | Berekening                                                    |
| --------------------- | ------------------------------------------------------------- |
| Budget `B`            | Σ budgetregels                                                |
| Gecontracteerd        | Σ `C(l)` van contractregels in `c`                            |
| Gefactureerd          | Σ `F(l)` in `c` + Σ losse kostenregels in `c`                 |
| Betaald               | betalingen naar rato verdeeld over de regels van het document |
| Openstaand            | gefactureerd − betaald                                        |
| Vastgelegd `V`        | Σ `P(l)` in `c` + Σ losse kostenregels in `c`                 |
| Nog te verwachten `R` | 0 als de categorie is afgesloten, anders `max(0, B − V)`      |
| **Prognose**          | `V + R` (dus `max(B, V)` zolang de categorie open is)         |
| Afwijking             | prognose − budget (positief = overschrijding)                 |
| Nog niet vastgelegd   | `R`: budget waarvoor nog geen contract of uitgave is          |

Zo blijft de prognose minimaal het budget zolang er nog werk open staat, en wordt
een meevaller pas zichtbaar als je de categorie **expliciet afsluit**.

**Controle bij afsluiten.** Voordat een categorie afgesloten kan worden, toont het
systeem een controlelijst. De gebruiker moet de waarschuwingen bevestigen; bij
geen enkele waarschuwing kan direct worden afgesloten.

| Controle                   | Waarschuwing als                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Openstaande facturen       | geboekte documenten in de categorie zijn nog niet (volledig) betaald                     |
| Openstaande verplichtingen | een actief contract in de categorie heeft `C(l) > F(l)`: er komt nog een factuur         |
| Termijnen                  | termijnen uit een termijnschema zijn nog niet gefactureerd                               |
| Meer-/minderwerk           | er staat meer-/minderwerk met status `voorgesteld`                                       |
| Te controleren             | er zijn documenten met status `concept` of `te_controleren` met regels in deze categorie |

Afsluiten wordt gelogd in `activity_log` (wie, wanneer, welke waarschuwingen
bevestigd) en kan door een eigenaar of bewerker weer worden heropend.

### 3.5 Projecttotalen en financiering

```
Totale prognose      = Σ prognose over alle eindcategorieën
Totaal beschikbaar   = Σ hoofdbronnen (bronnen zonder bovenliggende bron)
Financiële ruimte    = totaal beschikbaar − totale prognose   ← hoofdgetal dashboard
Saldo per bron       = bedrag bron − Σ betalingen uit die bron
Bouwdepot resterend  = bedrag bouwdepot − Σ betalingen uit het bouwdepot
```

Hoofdbronnen: `eigen_geld`, `hypotheek`, `schenking`, `lening`, `overig`.

**Het bouwdepot is een onderdeel van de hypotheek, geen extra bron.** Een
hypotheek is één hoofdbron met het totale leenbedrag. Die bron wordt verdeeld in
**delen** (`funding_sources` met `parent_source_id`): het `bouwdepot` en de
`overige_hypotheekruimte`. Delen tellen **nooit** mee in het totaal beschikbaar;
ze bestaan alleen om bij te houden waaruit betaald is.

| Bron                             | Bedrag        | Telt mee in totaal |
| -------------------------------- | ------------- | ------------------ |
| Hypotheek (hoofdbron)            | € 400.000     | **ja**             |
| ├ Bouwdepot (deel)               | € 100.000     | nee                |
| └ Overige hypotheekruimte (deel) | € 300.000     | nee                |
| **Totale financiering**          | **€ 400.000** |                    |

- De database controleert dat de delen samen precies het bedrag van de hoofdbron
  zijn.
- Een betaling wijst naar het meest specifieke deel (bijv. het bouwdepot). Het
  saldo van de hoofdbron is de som van de saldi van de delen.
- Een hoofdbron zonder delen (eigen geld) wordt direct als betaalbron gebruikt.

### 3.6 Ruimtes

Ruimtes (keuken, woonkamer, slaapkamer 1, …) staan los van de financiële
categorieën. Een kostenregel of contractregel heeft altijd **één categorie** en
**nul of meer ruimtes**, met een verdeling in procenten die samen 100% is. Standaard
wordt gelijk verdeeld.

- Rapport per categorie: telt elke regel één keer.
- Rapport per ruimte: telt `bedrag × aandeel` per ruimte, plus een rij
  "Niet aan een ruimte toegewezen". Het totaal is daardoor altijd gelijk aan het
  totaal per categorie.
- Kostenregels op contractniveau nemen de ruimteverdeling van de contractregels over.

### 3.7 Eén bon, meerdere kostenregels

Een document (`cost_documents`) verwijst naar **één** origineel bestand (`files`)
en heeft **één of meer** kostenregels. De IKEA-bon wordt dus één document met
bijvoorbeeld drie regels: keuken, woonkamer en slaapkamer. Elke regel heeft een
eigen categorie, ruimte(s) en BTW-tarief. Het bestand staat één keer in de opslag.

### 3.8 BTW, afronding en controles

- Elke regel slaat op: `bedrag_excl`, `btw_tarief` (21 / 9 / 0 / verlegd),
  `btw_bedrag` en `bedrag_incl`. De database dwingt `incl = excl + btw` af.
- Invoer kan excl. of incl. BTW. Het andere bedrag wordt per regel op hele centen
  berekend; de bedragen zoals ze op het document staan gaan voor.
- Elk document slaat ook het **totaal zoals op het papier** op. Wijkt de som van
  de regels daarvan af, dan krijgt het document een waarschuwing en kan het niet
  geboekt worden.
- Bij verdelen naar rato (termijnfactuur over contractregels, betaling over regels,
  regel over ruimtes) gebruiken we de **grootste-restmethode**. De delen tellen
  daardoor altijd exact, tot op de cent, op tot het geheel.
- **Alleen bevestigde documenten met status `geboekt` tellen mee.** Concepten en documenten
  die nog gecontroleerd moeten worden zie je apart ("3 documenten te controleren").

### 3.9 Waar de rekenlogica staat

Alle regels uit dit hoofdstuk staan als pure TypeScript-functies in `lib/finance/`.
Ze krijgen de rijen uit de database binnen en geven de totalen terug. Dashboard,
budgetpagina, rapportages en exports gebruiken allemaal dezelfde functies. Ieder
voorbeeld uit dit document is een unit test.

| Bestand           | Inhoud                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `verdeel.ts`      | Verdelen naar rato met de grootste-restmethode (exact tot op de cent)                                     |
| `bereken.ts`      | `berekenProject()`: contracten, categorieën, projecttotalen, financiering, ruimtes, termijnen, documenten |
| `afsluiten.ts`    | `controleerAfsluiten()`: controlelijst vóór het afsluiten van een categorie                               |
| `wat-als.ts`      | `metExtraContract()`: de prognose alsof een offerte al is geaccepteerd (voorbeeld vóór het besluit)       |
| `uit-database.ts` | Databaserijen → invoer van de rekenlogica                                                                 |
| `*.test.ts`       | Voorbeelden uit dit document, plus invarianten op 300 willekeurige projecten                              |

### 3.10 Uitwerking in code (vastgelegd in fase 3)

Keuzes die bij het programmeren concreet zijn gemaakt:

- **Alle bedragen inclusief BTW.** Betalingen zijn altijd incl. BTW, dus de
  rekenlogica rekent consequent incl. BTW (keuze van de opdrachtgever).
- **Kostenregel op een heel contract met een categorie** (bijv. een
  termijnfactuur voor alleen het keukendeel): naar rato over de contractregels
  in díe categorie; heeft het contract daar geen regels, dan over alle regels.
- **Kosten op een contract zonder contractregels** tellen als losse kosten in
  hun categorie, met een melding.
- **Geannuleerd contract:** geen toezegging (gecontracteerd = 0); wat al
  gefactureerd is telt mee. **Afgerond contract:** prognose = gefactureerd.
- **Betalingen** worden naar rato van de bedragen over de regels van het
  document verdeeld; daarmee is "betaald" per categorie, contractregel en
  ruimte bekend. Bij een document met plus- en minregels blijft dit exact.
- **Afgesloten hoofdcategorie** sluit ook alle subcategorieën.
- **Ruimterapport:** gecontracteerd, gefactureerd, betaald en vastgelegd per
  ruimte. Een kostenregel zonder eigen ruimteverdeling neemt die van zijn
  contractregel over. "Niet toegewezen" vult aan tot 100%, zodat de som van
  alle ruimtes gelijk is aan het projecttotaal.
- **Termijnschema:** termijnbedragen bij percentages worden met de
  grootste-restmethode berekend, zodat ze exact optellen tot het contract.
- **Betaalstatus** per geboekt document: open, deels, betaald of te laat
  (vervaldatum voorbij en nog niet betaald).
- **Meldingen** (geen fout, wel aandacht): kosten zonder categorie, kosten op
  een contract zonder regels, hypotheekdelen die niet optellen, kosten in een
  categorie zonder budget, meer betaald dan het documenttotaal.
- **Datums** worden overal ingevoerd als DD-MM-JJJJ (`components/ui/datum-veld.tsx`),
  ongeacht de taal van de browser, en als ISO (JJJJ-MM-DD) opgeslagen.

### 3.11 Offertes en contracten (vastgelegd in fase 5)

- **Een offerte telt nooit mee.** Pas bij **accepteren** ontstaat een contract
  (status actief) met precies dezelfde regels; de offerte krijgt de status
  "geaccepteerd" en is daarna niet meer te wijzigen. Eén offerte wordt hooguit
  één contract (unieke index op `contracts.quote_id`), dus dubbel accepteren
  kan niet.
- **Accepteren vraagt een categorie op elke regel**: een contract telt mee in
  het budget per categorie. Vóór het besluit toont de offertepagina het
  **effect op de prognose** per categorie en voor het hele project
  (`metExtraContract()` + `berekenProject()`). Valt een offerte binnen het
  budget van een open categorie, dan blijft de prognose gelijk aan het budget
  (§ 3.4).
- **Vergelijken** gebeurt per categorie: per offerte de som van haar regels in
  die categorie, goedkoopste eerst, met het verschil ten opzichte van het
  budget. Afgewezen en verlopen offertes doen niet mee.
- **Contract zonder offerte** (bijv. een mondelinge afspraak) kan ook; elke
  regel heeft dan meteen een categorie.
- **Meer- en minderwerk** hoort bij een contractregel. Een voorstel telt niet
  mee; na **akkoord** telt het mee in C(l) (§ 3.3), afgewezen telt niet. Wie en
  wanneer besliste, wordt vastgelegd. Goedgekeurd werk kan niet zomaar worden
  verwijderd: eerst terug naar "voorstel", zodat een toezegging nooit
  ongemerkt uit de prognose verdwijnt.
- **Termijnschema**: per termijn een percentage van het contract (inclusief
  goedgekeurd meer-/minderwerk) of een vast bedrag. Percentages samen hooguit
  100%. Termijnen verdelen het contractbedrag en tellen dus nooit extra mee;
  termijnfacturen (fase 6) worden eraan gekoppeld.
- **Status**: actief (prognose minimaal het contractbedrag), afgerond
  (prognose = gefactureerd; de app waarschuwt als er nog iets te factureren
  staat) of geannuleerd (alleen wat al gefactureerd is telt; vraagt om
  bevestiging). Elke statuswijziging en elke geaccepteerde offerte staat in het
  activiteitenlog.
- **Contract verwijderen** kan alleen zolang er geen facturen of bonnen aan
  hangen (anders: annuleren). Een gekoppelde offerte gaat dan terug naar
  "ontvangen".
- **Ruimtes per contractregel**: gelijk verdeeld over de gekozen ruimtes
  (grootste-restmethode in basispunten, samen precies 100%, gecontroleerd door
  de database).

### 3.12 Bestanden (vastgelegd in fase 5)

- Uploaden gaat **rechtstreeks van de browser naar de privé opslag**, met een
  eenmalige uploadlink die de server alleen aan projectleden geeft. Zo geldt
  de limiet van 4,5 MB per verzoek bij Vercel niet; de grens is 20 MB.
- Toegestaan: PDF, JPG, PNG, WebP en HEIC. De server controleert na het
  uploaden grootte en type van het opgeslagen bestand en registreert het pas
  daarna in `files`.
- **Elk origineel één keer**: de browser berekent een SHA-256; staat hetzelfde
  bestand al in het project, dan wordt het bestaande gebruikt. Een bestand
  wordt pas verwijderd als niets er meer naar verwijst.
- Bekijken gaat via een **tijdelijke link (1 uur)** die per paginabezoek wordt
  gemaakt; alleen projectleden krijgen die. Bestanden staan per project in een
  eigen map (`<project-id>/…`), afgeschermd door de opslagregels.
- Nog te doen (fase 10): bestanden opruimen van projecten die worden
  verwijderd (bijv. als het laatste lid zijn account opheft).

### 3.13 Facturen, bonnen en betalingen (vastgelegd in fase 6)

- **Soorten**: factuur, termijnfactuur, eindfactuur, creditnota en bon. Elk
  document heeft regels; elke regel hoort bij een **contractregel**, een
  **heel contract** (naar rato over de contractregels) of is een **losse
  kostenpost in een categorie**. Zo telt een factuur altijd binnen het contract
  en nooit erbovenop (§ 3.3): een offerte van € 15.000 met drie termijnfacturen
  van € 5.000 blijft € 15.000.
- **Eén bon, meerdere regels**: een bon wordt over categorieën verdeeld; het
  originele bestand wordt één keer bewaard. Per regel kunnen ruimtes worden
  gekozen (gelijk verdeeld); zonder keuze gelden bij een contractregel de
  ruimtes van het contract.
- **Concept, te controleren, geboekt, vervallen**: alleen geboekte documenten
  tellen mee. Boeken kan alleen als er regels zijn en, als het totaal op het
  document is ingevuld, de regels daar precies op uitkomen (app én database).
  De database legt vast wie boekte en wanneer. "Te controleren" toont alles wat
  nog niet geboekt is (vanaf fase 8 ook AI-voorstellen).
- **Opslaan in één keer** via `save_cost_document` (§ 4): document, regels en
  ruimteverdeling, of niets. Daardoor kan ook een geboekt en (deels) betaald
  document worden gecorrigeerd, zolang het daarna klopt.
- **Termijn- en eindfactuur** worden het makkelijkst ingevoerd vanaf het
  contract: soort, contract, termijn en het nog te factureren bedrag staan dan
  al ingevuld. Zonder gekozen leverancier geldt die van het contract.
- **Creditnota**: bedragen worden ingevuld zoals op het papier en negatief
  opgeslagen; een terugbetaling is ook negatief.
- **Betalingen**: alleen op geboekte documenten, in delen mogelijk, samen nooit
  meer dan het totaal. Optioneel uit welke financieringsbron (nooit uit een
  hypotheek die in delen is gesplitst: dan het deel, bijv. het bouwdepot).
  Betaalstatus: open, deels, betaald of te laat (vervaldatum voorbij).
- **Dubbel invoeren** wordt herkend: hetzelfde bestand (SHA-256) bij een ander
  document, en hetzelfde factuurnummer bij dezelfde leverancier.
- **Terugzetten of laten vervallen** kan alleen zolang er geen betalingen zijn;
  verwijderen haalt document, regels en betalingen in één keer weg.

---

## 4. Database-tabellen

Elke tabel heeft ook `id` (uuid), `project_id`, `created_by`, `created_at` en
`updated_at`. Bedragen eindigen op `_cents` en zijn `bigint`.

### Toegang

| Tabel             | Belangrijkste velden                             |
| ----------------- | ------------------------------------------------ |
| `profiles`        | user_id, volledige naam                          |
| `projects`        | naam, adres, verwachte oplevering                |
| `project_members` | user_id, rol: `eigenaar` / `bewerker` / `lezer`  |
| `project_invites` | e-mail, rol, token, verloopt_op, geaccepteerd_op |

### Structuur

| Tabel        | Belangrijkste velden                                          |
| ------------ | ------------------------------------------------------------- |
| `categories` | parent_id, naam, volgorde, kleur, is_afgesloten               |
| `rooms`      | naam, verdieping, volgorde                                    |
| `suppliers`  | naam, contactpersoon, e-mail, telefoon, IBAN, KvK, BTW-nummer |

### Financieel

| Tabel                   | Belangrijkste velden                                                                                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `budget_lines`          | category_id (eindcategorie), omschrijving, bedragen excl/btw/incl                                                                                                                                                                                                                      |
| `quotes`                | supplier_id, file_id, offertenummer, datum, geldig_tot, status: `ontvangen` / `geaccepteerd` / `afgewezen` / `verlopen`                                                                                                                                                                |
| `quote_lines`           | quote_id, category_id, omschrijving, bedragen                                                                                                                                                                                                                                          |
| `contracts`             | supplier_id, quote_id (optioneel), titel, getekend_op, status: `actief` / `afgerond` / `geannuleerd`                                                                                                                                                                                   |
| `contract_lines`        | contract_id, category_id, omschrijving, bedragen                                                                                                                                                                                                                                       |
| `contract_changes`      | contract_line_id, omschrijving, bedragen (+ meerwerk, − minderwerk), status: `voorgesteld` / `akkoord` / `afgewezen`                                                                                                                                                                   |
| `contract_installments` | contract_id, omschrijving, percentage of bedrag, verwachte datum                                                                                                                                                                                                                       |
| `cost_documents`        | type: `factuur` / `termijnfactuur` / `eindfactuur` / `creditnota` / `bon`; supplier_id, file_id, contract_id, installment_id, documentnummer, documentdatum, vervaldatum, totaal_op_document, status: `concept` / `te_controleren` / `geboekt` / `vervallen`, bron: `handmatig` / `ai` |
| `cost_lines`            | cost_document_id, category_id, contract_id, contract_line_id, omschrijving, bedragen                                                                                                                                                                                                   |
| `room_allocations`      | room_id, cost_line_id **of** contract_line_id, aandeel (basispunten, totaal per regel 10.000)                                                                                                                                                                                          |
| `payments`              | cost_document_id, funding_source_id, depot_claim_id, bedrag, betaaldatum, omschrijving                                                                                                                                                                                                 |

### Financiering

| Tabel             | Belangrijkste velden                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `funding_sources` | type, naam, verstrekker, bedrag, rente, ingangsdatum, einddatum, parent_source_id (leeg = hoofdbron; gevuld = deel, bijv. bouwdepot) |
| `depot_claims`    | funding_source_id, declaratienummer, ingediend_op, uitbetaald_op, status (schermen later)                                            |

### Documenten en AI

| Tabel                  | Belangrijkste velden                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files`                | opslagpad, originele naam, mime-type, grootte, **sha256** (uniek per project)                                                                                                             |
| `document_extractions` | file_id, status, model, resultaat (jsonb, per veld: waarde + zekerheid), issues (jsonb), voorgestelde leverancier/contract, mogelijke duplicaten, cost_document_id, gecontroleerd_door/op |
| `activity_log`         | gebruiker, actie, tabel, record_id, wijziging (jsonb), tijdstip                                                                                                                           |

### Controles in de database

- Een kostenregel heeft een categorie, een contract of beide. Bij een gekoppelde
  contractregel moet de categorie gelijk zijn aan die van de contractregel
  (trigger).
- Budget-, contract- en kostenregels mogen alleen aan eindcategorieën hangen.
- Ruimteverdeling per regel telt op tot precies 100%.
- Uniek per project: leverancier + documentnummer (voor facturen), en sha256 van
  bestanden.
- Betalingen op een document zijn samen nooit meer dan het documenttotaal,
  en alleen mogelijk op een geboekt document.
- Een geboekt document heeft minstens één regel; is het totaal op het document
  ingevuld, dan tellen de regels daar precies op uit. Bij boeken legt de
  database vast wie en wanneer.
- `save_cost_document` en `delete_cost_document` (0011): document met regels,
  ruimteverdeling en betalingen in één transactie, met de rechten van de
  gebruiker (RLS blijft gelden).
- Row Level Security op elke tabel: lezen voor alle leden, schrijven alleen voor
  `eigenaar` en `bewerker`. Leden en uitnodigingen beheert alleen de `eigenaar`.

---

## 5. AI-documentherkenning

**Uitgangspunt: de AI stelt voor, de gebruiker beslist.** Niets wordt automatisch
geboekt.

1. **Upload** (camera op telefoon of PDF). De server berekent de sha256. Is
   precies dit bestand al bekend, dan volgt direct de melding "dit document is al
   geüpload" met een link.
2. **Uitlezen**: Claude krijgt het document met een vast JSON-schema. Terug komen
   per veld een waarde, een zekerheid (0–1) en de tekst waar het op gebaseerd is:
   leverancier, KvK/IBAN, documenttype, nummer, datums, totaal, BTW per tarief en
   **alle regels**, elk met een voorgestelde categorie (uit onze eigen lijst) en
   ruimte.
3. **Controle op de server**:
   - som van de regels = totaal op document, BTW-bedragen kloppen per tarief;
   - leverancier matchen op KvK, IBAN of naam;
   - **contract of offerte voorstellen**: zelfde leverancier, verwijzing naar
     offertenummer, bedrag past binnen het nog niet gefactureerde deel of komt
     overeen met een termijn;
   - **duplicaatdetectie**: zelfde leverancier + documentnummer, of zelfde bedrag +
     leverancier binnen ±7 dagen;
   - **verplichte gegevens aanwezig**: leverancier, documentdatum, totaal en
     minstens één regel; bij facturen ook documentnummer en vervaldatum (of
     betaaltermijn);
   - **rekenkundige controles** (los van wat de AI zegt): per regel
     `excl + btw = incl`, BTW-bedrag past bij het tarief (afrondingsmarge 1 cent
     per regel), som van de regels = totaal op document, BTW per tarief = som van
     de regels met dat tarief;
   - een **zekerheid onder 85%** geldt alleen als _indicatieve_ waarschuwing. Ook
     een hoge zekerheid maakt een veld niet "goedgekeurd": de rekenkundige controles
     en de bevestiging door de gebruiker beslissen, niet het percentage van de AI.
4. **Controlescherm**: links het origineel, rechts het voorstel. Per veld zie je
   een markering: _ontbreekt_, _klopt niet_ (mislukte controle), _onzeker_ (< 85%)
   of _controleren_. Regels kun je splitsen, samenvoegen en aan een andere
   categorie, ruimte of contract koppelen.
5. **Bevestigen en boeken**: **elk** AI-voorstel moet door een gebruiker worden
   bevestigd, ook als alles klopt. Zolang een verplicht veld ontbreekt of een
   rekenkundige controle faalt, is de knop "Boeken" geblokkeerd. Na bevestiging
   krijgt het document status `geboekt`, worden `gecontroleerd_door/op` vastgelegd
   en telt het mee.

Privacy: documenten gaan voor het uitlezen naar de Claude API. De API-sleutel en
alle AI-aanroepen blijven op de server.

---

## 6. Pagina's en navigatie

Desktop: zijbalk links. Mobiel: tabbalk onderin (Dashboard, Budget, Documenten,
Leveranciers, Meer) met een centrale **"+"-knop** voor "Bon/factuur toevoegen".

| Pagina                               | Inhoud                                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inloggen / registreren / uitnodiging | E-mail + wachtwoord, wachtwoord vergeten                                                                                                                          |
| Dashboard                            | KPI's (budget, prognose, betaald, openstaand, ruimte), budget vs. prognose per categorie, uitgaven per maand, bijna vervallen facturen, te controleren documenten |
| Budget                               | Categorieboom met budget, gecontracteerd, gefactureerd, betaald, prognose en afwijking                                                                            |
| Ruimtes                              | Dezelfde cijfers per ruimte                                                                                                                                       |
| Offertes                             | Lijst, detail met PDF, vergelijken, "Accepteren → contract"                                                                                                       |
| Contracten                           | Per opdracht: regels, meer-/minderwerk, termijnschema, gekoppelde facturen, prognose                                                                              |
| Documenten                           | Facturen, termijnfacturen, eindfacturen, creditnota's en bonnen, met betaalstatus                                                                                 |
| Te controleren                       | Wachtrij van AI-voorstellen                                                                                                                                       |
| Leveranciers                         | Contactgegevens en totalen per leverancier                                                                                                                        |
| Financiering                         | Bronnen en saldi (uitgebreide versie met bouwdepot later)                                                                                                         |
| Rapportages                          | Per categorie, per ruimte en per leverancier, export naar Excel/CSV en PDF                                                                                        |
| Instellingen                         | Project, categorieën, ruimtes, leden en rollen, profiel                                                                                                           |

---

## 7. Bouwvolgorde

Na elke fase: testen, committen, pushen en wachten op feedback.

| Fase                                    | Inhoud                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 0. Fundament ✓                          | Next.js 16, TypeScript, Tailwind, ESLint, Prettier, Vitest, NL-opmaak voor euro en datum, dit document                       |
| 1. Ontwerp-shell ✓                      | shadcn/ui, thema (licht/donker), zijbalk + mobiele tabbalk, KPI-kaart, tabel, lege toestanden                                |
| 2. Supabase + inloggen ✓                | Auth, profielen, projecten, leden, uitnodigingen, RLS; **eerste online versie op Vercel** zodat beide accounts kunnen testen |
| 3. Datamodel + rekenlogica ✓            | Alle migraties uit hoofdstuk 4, `lib/finance` met tests voor alle voorbeelden, Nederlands datumveld                          |
| 4. Categorieën, ruimtes, budget ✓       | Beheer en budgetpagina                                                                                                       |
| 5. Leveranciers, offertes, contracten ✓ | Offerte accepteren → contract, meer-/minderwerk, termijnschema                                                               |
| 6. Documenten en betalingen ✓           | Facturen, termijn- en eindfacturen, creditnota's, bonnen met meerdere regels, uploads, betalingen                            |
| 7. Dashboard en rapportages             | KPI's, grafieken, rapport per categorie/ruimte/leverancier, export                                                           |
| 8. AI-documentherkenning                | Uitlezen, controles, duplicaten, contractkoppeling, controlescherm                                                           |
| 9. Financiering                         | Bronnen en saldi; daarna uitgebreid bouwdepot en declaraties                                                                 |
| 10. Afronding                           | PWA, prestaties, toegankelijkheid, beveiligingscontrole, eigen domein                                                        |
