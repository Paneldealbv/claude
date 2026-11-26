#!/usr/bin/env node
/**
 * Beheer van het Supabase-project via de Supabase Management API.
 *
 *   node scripts/supabase-beheer.mjs controle         alleen lezen: regio, status, migraties
 *   node scripts/supabase-beheer.mjs migreer --droog  toon welke migraties zouden draaien
 *   node scripts/supabase-beheer.mjs migreer          voer nieuwe migraties uit
 *   node scripts/supabase-beheer.mjs beveiliging      alleen lezen: RLS, rechten, bucket
 *   node scripts/supabase-beheer.mjs auth --droog     toon de Auth-instellingen
 *   node scripts/supabase-beheer.mjs auth             stel Auth in (NL e-mails, URL's)
 *   node scripts/supabase-beheer.mjs env-local        schrijf .env.local (alleen publieke waarden)
 *
 * Instellingen (environment variables, nooit in de code):
 *   SUPABASE_PROJECT_REF    bijv. jqebvrnhnesgfsewhqpl
 *   SUPABASE_ACCESS_TOKEN   persoonlijk toegangstoken (supabase.com → Account → Access Tokens)
 *   SITE_URLS               komma-gescheiden adressen van de app, eerste = hoofdadres
 *
 * Elke migratie draait in één transactie: bij een fout wordt niets gewijzigd.
 * Uitgevoerde migraties worden bijgehouden in supabase_migrations.schema_migrations
 * (zelfde tabel als de Supabase CLI gebruikt).
 */
import { readFile, readdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || "via-proxy";
const API = "https://api.supabase.com/v1";
const [opdracht, ...vlaggen] = process.argv.slice(2);
const droog = vlaggen.includes("--droog");

if (!REF || !/^[a-z0-9]{20}$/.test(REF)) {
  stop("Stel SUPABASE_PROJECT_REF in (20 kleine letters/cijfers).");
}

function stop(melding) {
  console.error(`✗ ${melding}`);
  process.exit(1);
}

async function api(pad, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${pad}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const tekst = await res.text();
  let data;
  try {
    data = tekst ? JSON.parse(tekst) : null;
  } catch {
    data = tekst;
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data
        ? (data.message ?? JSON.stringify(data))
        : data;
    throw new Error(`${method} ${pad} → ${res.status}: ${msg}`);
  }
  return data;
}

const sql = (query) =>
  api(`/projects/${REF}/database/query`, { method: "POST", body: { query } });

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

// -----------------------------------------------------------------------------
async function project() {
  const p = await api(`/projects/${REF}`);
  console.log(`Project:  ${p.name} (${p.id})`);
  console.log(
    `Regio:    ${p.region}${p.region === "eu-central-1" ? " (Frankfurt) ✓" : " ✗ NIET Frankfurt"}`,
  );
  console.log(`Status:   ${p.status}`);
  if (p.database?.version) console.log(`Postgres: ${p.database.version}`);
  if (p.region !== "eu-central-1")
    stop("Het project staat niet in Frankfurt (eu-central-1).");
  return p;
}

async function migratieBestanden() {
  const map = path.join(ROOT, "supabase", "migrations");
  return (await readdir(map))
    .filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((f) => ({
      versie: f.slice(0, 14),
      naam: f.slice(15, -4),
      pad: path.join(map, f),
    }));
}

async function uitgevoerd() {
  const rijen = await sql(`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
    ) as bestaat`);
  if (!rijen?.[0]?.bestaat) return new Set();
  const versies = await sql(
    `select version from supabase_migrations.schema_migrations`,
  );
  return new Set(versies.map((r) => r.version));
}

async function migreer() {
  await project();
  const alle = await migratieBestanden();
  const gedaan = await uitgevoerd();
  const nieuw = alle.filter((m) => !gedaan.has(m.versie));

  console.log(
    `\nMigraties: ${alle.length} totaal, ${gedaan.size} al uitgevoerd, ${nieuw.length} nieuw.`,
  );
  for (const m of alle) {
    console.log(`  ${gedaan.has(m.versie) ? "✓" : "•"} ${m.versie}_${m.naam}`);
  }
  if (!nieuw.length || droog) {
    if (droog && nieuw.length) console.log("\n(droog: er is niets uitgevoerd)");
    return;
  }

  for (const m of nieuw) {
    const inhoud = await readFile(m.pad, "utf8");
    process.stdout.write(`→ ${m.versie}_${m.naam} … `);
    await sql(`
      begin;
      ${inhoud}
      ;
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key, statements text[], name text
      );
      insert into supabase_migrations.schema_migrations (version, name, statements)
      values (${lit(m.versie)}, ${lit(m.naam)}, array[${lit(inhoud)}]);
      commit;`);
    console.log("klaar");
  }
  console.log("\n✓ Alle migraties uitgevoerd.");
}

// -----------------------------------------------------------------------------
async function beveiliging() {
  await project();
  const zonderRls = await sql(`
    select tablename from pg_tables
    where schemaname = 'public' and not rowsecurity order by 1`);
  const anonRechten = await sql(`
    select distinct table_name from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public' order by 1`);
  const bucket = await sql(`
    select id, public, file_size_limit from storage.buckets where id = 'documenten'`);
  const policies = await sql(`
    select schemaname, tablename, count(*)::int as aantal from pg_policies
    where schemaname in ('public', 'storage') group by 1, 2 order by 1, 2`);
  const tabellen = await sql(`
    select count(*)::int as n from pg_tables where schemaname = 'public'`);

  console.log(`\nTabellen in public: ${tabellen[0].n}`);
  console.log(
    zonderRls.length
      ? `✗ Tabellen ZONDER RLS: ${zonderRls.map((r) => r.tablename).join(", ")}`
      : "✓ RLS staat aan op alle tabellen",
  );
  console.log(
    anonRechten.length
      ? `✗ anon heeft rechten op: ${anonRechten.map((r) => r.table_name).join(", ")}`
      : "✓ niet-ingelogde bezoekers hebben op geen enkele tabel rechten",
  );
  console.log(
    bucket.length && bucket[0].public === false
      ? `✓ bucket 'documenten' is privé (max ${bucket[0].file_size_limit / 1048576} MB)`
      : "✗ privé bucket 'documenten' ontbreekt of is openbaar",
  );
  console.log("\nBeveiligingsregels per tabel:");
  for (const p of policies)
    console.log(`  ${p.schemaname}.${p.tablename}: ${p.aantal}`);
  if (zonderRls.length || anonRechten.length) process.exit(1);
}

// -----------------------------------------------------------------------------
const knop = (href, tekst) =>
  `<p style="margin:28px 0"><a href="${href}" style="background:#0f6b52;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;font-family:Inter,Arial,sans-serif">${tekst}</a></p>`;
const mail = (titel, tekst, href, knoptekst, voet) =>
  `
<div style="font-family:Inter,Arial,sans-serif;color:#17181a;max-width:480px;margin:0 auto;padding:24px">
  <p style="font-size:13px;color:#696b70;margin:0 0 24px">Nieuwbouw Dashboard</p>
  <h1 style="font-size:20px;margin:0 0 12px">${titel}</h1>
  <p style="font-size:15px;line-height:1.6;margin:0">${tekst}</p>
  ${knop(href, knoptekst)}
  <p style="font-size:13px;line-height:1.6;color:#696b70;margin:0">${voet}</p>
</div>`.trim();

function authConfig() {
  const urls = (process.env.SITE_URLS || "http://localhost:3000")
    .split(",")
    .map((u) => u.trim().replace(/\/$/, ""))
    .filter(Boolean);
  for (const u of urls) {
    if (!/^https:\/\/[a-z0-9.-]+$|^http:\/\/localhost:\d+$/.test(u)) {
      stop(`Ongeldig adres in SITE_URLS: ${u}`);
    }
  }
  // De app geeft als RedirectTo altijd ".../auth/bevestigen?volgende=…" mee.
  return {
    site_url: urls[0],
    uri_allow_list: urls.map((u) => `${u}/auth/bevestigen**`).join(","),
    mailer_autoconfirm: false,
    password_min_length: 10,
    security_update_password_require_reauthentication: false,
    mailer_subjects_confirmation: "Bevestig je e-mailadres",
    mailer_templates_confirmation_content: mail(
      "Bevestig je e-mailadres",
      "Welkom bij het Nieuwbouw Dashboard. Klik op de knop om je account te activeren.",
      "{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email",
      "E-mailadres bevestigen",
      "Heb je geen account aangemaakt? Dan kun je deze mail negeren.",
    ),
    mailer_subjects_recovery: "Nieuw wachtwoord instellen",
    mailer_templates_recovery_content: mail(
      "Nieuw wachtwoord instellen",
      "Je hebt gevraagd om een nieuw wachtwoord. Klik op de knop om er een te kiezen. De link is één uur geldig.",
      "{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery",
      "Nieuw wachtwoord kiezen",
      "Heb je dit niet aangevraagd? Dan kun je deze mail negeren; je wachtwoord blijft hetzelfde.",
    ),
    mailer_subjects_email_change: "Bevestig je nieuwe e-mailadres",
    mailer_templates_email_change_content: mail(
      "Bevestig je nieuwe e-mailadres",
      "Klik op de knop om {{ .NewEmail }} als nieuw e-mailadres te bevestigen.",
      "{{ .SiteURL }}/auth/bevestigen?token_hash={{ .TokenHash }}&type=email_change",
      "Nieuw e-mailadres bevestigen",
      "Heb je dit niet aangevraagd? Neem dan contact op met de eigenaar van het project.",
    ),
  };
}

async function auth() {
  await project();
  const config = authConfig();
  console.log("\nAuth-instellingen:");
  console.log(`  Site URL:           ${config.site_url}`);
  console.log(
    `  Toegestane links:   ${config.uri_allow_list.split(",").join("\n                      ")}`,
  );
  console.log(`  E-mail bevestigen:  verplicht`);
  console.log(`  Min. wachtwoord:    ${config.password_min_length} tekens`);
  console.log(
    `  E-mails:            Nederlands (bevestigen, wachtwoord, e-mail wijzigen)`,
  );
  if (droog) return console.log("\n(droog: er is niets gewijzigd)");
  await api(`/projects/${REF}/config/auth`, { method: "PATCH", body: config });
  console.log("\n✓ Auth ingesteld.");
}

// -----------------------------------------------------------------------------
async function envLocal() {
  const doel = path.join(ROOT, ".env.local");
  try {
    await access(doel);
    stop(".env.local bestaat al; niet overschreven.");
  } catch {}
  const sleutels = await api(`/projects/${REF}/api-keys`);
  const publishable = sleutels.find((k) => k.type === "publishable");
  if (!publishable?.api_key?.startsWith("sb_publishable_")) {
    stop(
      "Geen publishable key gevonden. Maak er een aan in Project Settings → API Keys.",
    );
  }
  await writeFile(
    doel,
    [
      "# Lokaal; staat in .gitignore en wordt nooit gecommit.",
      `NEXT_PUBLIC_SUPABASE_URL=https://${REF}.supabase.co`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable.api_key}`,
      "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  console.log("✓ .env.local geschreven (alleen publieke waarden).");
}

// -----------------------------------------------------------------------------
async function livetest() {
  await project();
  const inhoud = await readFile(
    path.join(ROOT, "supabase", "tests", "live-check.sql"),
    "utf8",
  );
  try {
    await sql(inhoud);
    stop("Onverwacht: de live-test eindigde zonder resultaat.");
  } catch (e) {
    const m = /LIVE-TEST GESLAAGD[^"\\]*/.exec(e.message);
    if (m) {
      console.log(`\n✓ ${m[0]}`);
      return;
    }
    stop(`Live-test mislukt: ${e.message}`);
  }
}

const opdrachten = {
  livetest,
  controle: async () => {
    await project();
    const g = await uitgevoerd();
    console.log(`Migraties uitgevoerd: ${g.size}`);
  },
  migreer,
  beveiliging,
  auth,
  "env-local": envLocal,
};
if (!opdrachten[opdracht]) {
  stop(`Onbekende opdracht. Kies uit: ${Object.keys(opdrachten).join(", ")}`);
}
opdrachten[opdracht]().catch((e) => stop(e.message));
