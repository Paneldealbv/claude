# Nieuwbouw Dashboard

Gedeelde webapplicatie voor het beheren van budgetten, offertes, contracten,
facturen, bonnetjes en financiering van onze nieuwbouwwoning.

- **Architectuur en rekenregels:** [docs/ARCHITECTUUR.md](docs/ARCHITECTUUR.md)
- **Supabase, inloggen en beveiliging:** [docs/SUPABASE.md](docs/SUPABASE.md)
- **Stack:** Next.js 16 · TypeScript · Tailwind CSS · Supabase · Vercel

## Lokaal starten

Vereist: Node.js 22 of nieuwer.

```bash
npm install
cp .env.example .env.local   # Supabase-URL en publishable key invullen
npm run dev                  # http://localhost:3000
```

## Scripts

| Commando                       | Doel                                                        |
| ------------------------------ | ----------------------------------------------------------- |
| `npm run dev`                  | Ontwikkelserver                                             |
| `npm run build`                | Productiebuild                                              |
| `npm run lint`                 | ESLint                                                      |
| `npm run typecheck`            | TypeScript-controle                                         |
| `npm test`                     | Unit tests (Vitest)                                         |
| `npm run test:db`              | Migraties + beveiligingstests op tijdelijke lokale Postgres |
| `npm run supabase`             | Beheer van het Supabase-project (zie docs/SUPABASE.md)      |
| `npm run format`               | Code opmaken met Prettier                                   |
| `npm run test:e2e`             | End-to-end test tegen Supabase (zie docs/SUPABASE.md)       |
| `node scripts/maak-iconen.mjs` | App-iconen opnieuw maken uit het logo                       |

## Afspraken

- Bedragen altijd in **hele centen** (integer). Gebruik `formatEuro` en
  `parseEuro` uit `lib/format.ts`.
- Datums tonen als **DD-MM-JJJJ** via `formatDatum`.
- Alle financiële berekeningen staan in `lib/finance/` en hebben tests.
- Geheimen staan alleen in `.env.local` / Vercel, nooit in de repository.
