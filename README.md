# Nieuwbouw Dashboard

Gedeelde webapplicatie voor het beheren van budgetten, offertes, contracten,
facturen, bonnetjes en financiering van onze nieuwbouwwoning.

- **Architectuur en rekenregels:** [docs/ARCHITECTUUR.md](docs/ARCHITECTUUR.md)
- **Stack:** Next.js 16 · TypeScript · Tailwind CSS · Supabase · Vercel

## Lokaal starten

Vereist: Node.js 22 of nieuwer.

```bash
npm install
cp .env.example .env.local   # waarden invullen vanaf fase 2
npm run dev                  # http://localhost:3000
```

## Scripts

| Commando            | Doel                      |
| ------------------- | ------------------------- |
| `npm run dev`       | Ontwikkelserver           |
| `npm run build`     | Productiebuild            |
| `npm run lint`      | ESLint                    |
| `npm run typecheck` | TypeScript-controle       |
| `npm test`          | Unit tests (Vitest)       |
| `npm run format`    | Code opmaken met Prettier |

## Afspraken

- Bedragen altijd in **hele centen** (integer). Gebruik `formatEuro` en
  `parseEuro` uit `lib/format.ts`.
- Datums tonen als **DD-MM-JJJJ** via `formatDatum`.
- Alle financiële berekeningen staan in `lib/finance/` en hebben tests.
- Geheimen staan alleen in `.env.local` / Vercel, nooit in de repository.
