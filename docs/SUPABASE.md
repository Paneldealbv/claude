# Supabase, inloggen en beveiliging

Fase 2. Aanvulling op [ARCHITECTUUR.md](ARCHITECTUUR.md).

## Overzicht

| Onderdeel                    | Waar                                             |
| ---------------------------- | ------------------------------------------------ |
| Database, Auth, Storage      | Supabase-project in **eu-central-1 (Frankfurt)** |
| Databasestructuur            | `supabase/migrations/*.sql` (11 migraties)       |
| Beveiligingstests (lokaal)   | `npm run test:db` → `supabase/tests/`            |
| Migraties en Auth instellen  | `scripts/supabase-beheer.mjs` (Management API)   |
| Supabase-koppeling in de app | `lib/supabase/`, `proxy.ts`, `lib/auth.ts`       |

## Sleutels en geheimen

| Waarde                                     | Geheim?                      | Waar staat het                                          |
| ------------------------------------------ | ---------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                 | nee                          | `.env.local`, Vercel                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`     | nee, voor de browser bedoeld | `.env.local`, Vercel                                    |
| `NEXT_PUBLIC_SITE_URL`                     | nee                          | `.env.local`, Vercel                                    |
| Secret key (`sb_secret_…`)                 | **ja**                       | wordt door de app niet gebruikt                         |
| Persoonlijk toegangstoken (Management API) | **ja**                       | alleen tijdelijk bij het uitvoeren van het beheerscript |
| Databasewachtwoord                         | **ja**                       | alleen bij de eigenaar                                  |

`.env*` staat in `.gitignore` (behalve `.env.example`). Er staan nergens sleutels
in de code of in GitHub.

## Sessies

- `@supabase/ssr` bewaart de sessie in cookies die **httpOnly** (niet leesbaar
  voor JavaScript), **secure** (alleen HTTPS) en **SameSite=Lax** zijn.
- `proxy.ts` ververst bij elk verzoek de sessie en stuurt niet-ingelogde
  bezoekers naar `/inloggen`.
- Elke pagina en actie controleert de gebruiker opnieuw met `getClaims()`
  (handtekening van het token wordt gecontroleerd), nooit alleen de cookie.
- Doorverwijzingen na inloggen accepteren alleen interne paden.
- Uitloggen beëindigt de sessie bij Supabase en wist de cookies.

## Uitnodigen

1. Een eigenaar vult in **Instellingen** een e-mailadres en rol in.
2. De database maakt een willekeurig token (64 tekens) en bewaart alleen de
   SHA-256-hash. De link wordt één keer getoond.
3. De ontvanger opent de link, maakt een account aan **met dat e-mailadres**,
   bevestigt het e-mailadres en klikt op "Uitnodiging accepteren".
4. De database controleert: token bestaat, niet verlopen (7 dagen), niet
   ingetrokken, niet eerder gebruikt, e-mailadres bevestigd en gelijk aan de
   uitnodiging.

## Beveiliging in de database

- **Row Level Security op alle tabellen**: lezen voor leden, wijzigen voor
  eigenaar en bewerker, leden en uitnodigingen alleen door de eigenaar.
- **Niet-ingelogde bezoekers** hebben op geen enkele tabel rechten; alleen
  `get_invite` (uitnodiging tonen) is zonder inloggen bruikbaar.
- **Samengestelde sleutels** (`project_id`, `id`): een regel kan nooit naar
  gegevens van een ander project verwijzen.
- **Kolomrechten**: e-mailadres in het profiel, project-id's en
  lidmaatschappen zijn niet direct te wijzigen.
- **Hulpfuncties** staan in het schema `private` (niet via de API bereikbaar),
  met een vast `search_path`.
- **Documenten opslaan** (0011): `save_cost_document` en
  `delete_cost_document` doen document, regels, ruimteverdeling en
  betalingen in één transactie. Ze draaien met de rechten van de gebruiker
  (`security invoker`), dus Row Level Security blijft gelden; alleen
  ingelogde gebruikers mogen ze aanroepen. Bij boeken legt de database zelf
  vast wie (de ingelogde gebruiker) en wanneer.
- **Opslag**: privé bucket `documenten` (max 20 MB, PDF en foto's). Bestanden
  staan onder `<project-id>/…` en zijn alleen voor leden van dat project.

## Tests

`npm run test:db` start een tijdelijke Postgres, bootst de Supabase-rollen
na (inclusief de strengere standaardrechten van nieuwe Supabase-projecten),
voert alle migraties uit en controleert 111 punten, waaronder:

- A (eigenaar), B (bewerker) en D (lezer) zien **exact dezelfde gegevens**
  in alle tabellen;
- C (geen lid) ziet in **geen enkele tabel** iets van het project en kan niets
  toevoegen, wijzigen of verwijderen, ook geen bestanden;
- niet-ingelogd: geen toegang tot tabellen en bestanden;
- uitnodigingen: één keer bruikbaar, verloopt, alleen voor het juiste en
  bevestigde e-mailadres;
- alle financiële controles uit de architectuur;
- ingelogde gebruikers kunnen geen tabel leegmaken (TRUNCATE) en geen
  technische kolommen (id, project_id, created_by) wijzigen;
- account verwijderen als laatste eigenaar: een ander lid wordt eigenaar, of
  het project wordt opgeruimd als er geen leden meer zijn;
- documenten opslaan in één keer: een geweigerde opslag laat niets half
  achter, een geboekt en betaald document kan worden gecorrigeerd zolang het
  klopt, lezers en niet-leden kunnen niets opslaan of verwijderen.

Daarnaast:

- **Live-controle** (`npm run supabase -- livetest`): 10 controles op de echte
  database in één transactie die altijd wordt teruggedraaid.
- **End-to-end** (`npm run test:e2e`): drie tijdelijke accounts doorlopen de
  echte app (inloggen, project, uitnodigen, budget, offertes, contracten,
  facturen, bonnen, betalingen, dashboard, rapportages en export) en de API;
  101 controles. Accounts, project en bestanden worden daarna volledig
  verwijderd.

## Rechten in een nieuw Supabase-project

Nieuwe Supabase-projecten geven ingelogde gebruikers standaard **geen** lees-
of schrijfrechten op nieuwe tabellen. Migratie `0009_rechten` geeft per tabel
precies wat de app nodig heeft. **Een nieuwe tabel in een latere migratie moet
daarom altijd ook expliciete `grant`s krijgen**; de lokale test controleert
dat elke tabel leesbaar is gemaakt (RLS filtert daarna de rijen).

## E-mail

Op het gratis plan met de standaard mailserver van Supabase:

- maximaal **2 e-mails per uur** voor het hele project (bevestigen en
  wachtwoord herstellen samen);
- de e-mailteksten zijn Engelstalig en niet aan te passen.

Nederlandse e-mails en hogere limieten kunnen later met een eigen
mailserver (bijv. Resend of Brevo, gratis te starten):
`npm run supabase -- auth --met-emails` na het instellen van SMTP.

## Online zetten (Vercel)

Productie: `https://nieuwbouw-dashboard-paneldeal.vercel.app` (vanaf `main`).

1. vercel.com → **Add New → Project** → **GitHub** → repository `claude`.
2. **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL` en
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `NEXT_PUBLIC_SITE_URL` is optioneel:
   zonder deze waarde gebruikt de app het adres van het verzoek.
3. **Deploy**. Serverfuncties draaien in Frankfurt (`fra1`, zie `vercel.json`).
4. **Settings → Deployment Protection → Vercel Authentication: Disabled.**
   Anders moet iedere bezoeker eerst bij Vercel inloggen; de app heeft een
   eigen login en de database eigen beveiliging.
5. Het productie-adres als Site URL in Supabase Auth zetten:
   `SITE_URLS=https://nieuwbouw-dashboard-paneldeal.vercel.app,http://localhost:3000 npm run supabase -- auth`

Controle na een deploy: `APP_URL=https://nieuwbouw-dashboard-paneldeal.vercel.app npm run test:e2e`
(20 controles met tijdelijke accounts die daarna worden verwijderd).
