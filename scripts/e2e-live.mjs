#!/usr/bin/env node
/**
 * End-to-end test via de echte app tegen het echte Supabase-project.
 *
 * Maakt drie tijdelijke testaccounts (A, B, C) en doorloopt:
 *   A logt in → maakt project → nodigt B uit
 *   B logt in → accepteert uitnodiging → ziet hetzelfde project en dezelfde gegevens
 *   C (geen toegang) ziet niets en kan niets wijzigen
 *   niet ingelogd → geen toegang
 * Daarna worden project en testaccounts volledig verwijderd en wordt
 * gecontroleerd dat er niets achterblijft.
 *
 * De secret key wordt alleen in het geheugen opgehaald (via de Management
 * API) om testaccounts aan te maken en te verwijderen; hij wordt nergens
 * opgeslagen of getoond.
 *
 * Vereist: app draait op APP_URL (standaard http://localhost:3000),
 * SUPABASE_PROJECT_REF en een access token (via de proxy of
 * SUPABASE_ACCESS_TOKEN).
 */
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || "via-proxy";
const APP = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const SCREENSHOTS = process.env.SCREENSHOT_DIR;
const URL_SB = `https://${REF}.supabase.co`;

let geslaagd = 0;
function ok(voorwaarde, label) {
  if (!voorwaarde) throw new Error(`MISLUKT - ${label}`);
  geslaagd++;
  console.log(`  ok - ${label}`);
}

async function mgmt(pad, init = {}) {
  const res = await fetch(`https://api.supabase.com/v1${pad}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${pad} → ${res.status}`);
  return res.json();
}

const sql = (query) =>
  mgmt(`/projects/${REF}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });

const geenSessie = { auth: { persistSession: false, autoRefreshToken: false } };

async function main() {
  const sleutels = await mgmt(`/projects/${REF}/api-keys?reveal=true`);
  const secret = sleutels.find((k) => k.type === "secret")?.api_key;
  const publishable = sleutels.find((k) => k.type === "publishable")?.api_key;
  if (!secret || !publishable) throw new Error("API-sleutels niet gevonden");

  const admin = createClient(URL_SB, secret, geenSessie);

  // Restanten van een eerder afgebroken testrun opruimen.
  const oud = await sql(
    `select id from auth.users where email like 'e2e-%@example.com'`,
  );
  for (const { id } of oud) {
    const { error } = await admin.auth.admin.deleteUser(id);
    console.log(
      error
        ? `  ! oud testaccount ${id} niet verwijderd: ${error.message}`
        : `  (oud testaccount ${id} opgeruimd)`,
    );
  }
  if (process.argv.includes("--alleen-opruimen")) return;
  const sfx = randomBytes(4).toString("hex");
  const accounts = Object.fromEntries(
    ["a", "b", "c"].map((x) => [
      x,
      {
        email: `e2e-${x}-${sfx}@example.com`,
        wachtwoord: randomBytes(18).toString("base64url"),
        naam: `E2E ${x.toUpperCase()}`,
      },
    ]),
  );

  const ids = [];
  let browser;
  let projectId;
  let clientA;

  try {
    console.log("→ Tijdelijke testaccounts aanmaken");
    for (const acc of Object.values(accounts)) {
      const { data, error } = await admin.auth.admin.createUser({
        email: acc.email,
        password: acc.wachtwoord,
        email_confirm: true,
        user_metadata: { full_name: acc.naam },
      });
      if (error) throw error;
      ids.push(data.user.id);
    }
    ok(ids.length === 3, "drie testaccounts aangemaakt (e-mail bevestigd)");

    // Online adres testen vanachter een proxy: de browser via die proxy laten gaan.
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const lokaal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(APP);
    browser = await chromium.launch(
      proxy && !lokaal ? { proxy: { server: proxy } } : {},
    );
    const pagina = async (acc) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const p = await ctx.newPage();
      await p.goto(`${APP}/inloggen`);
      await p.getByLabel("E-mailadres").fill(acc.email);
      await p.getByLabel("Wachtwoord", { exact: true }).fill(acc.wachtwoord);
      await p.getByRole("button", { name: "Inloggen" }).click();
      await p.waitForURL((u) => !u.pathname.startsWith("/inloggen"), {
        timeout: 20000,
      });
      await p.waitForLoadState("networkidle");
      return p;
    };

    // --- A: inloggen, project aanmaken, B uitnodigen -------------------------
    console.log("→ A: inloggen, project aanmaken en B uitnodigen");
    const pA = await pagina(accounts.a);
    // Zonder project stuurt het dashboard door naar /welkom.
    await pA.waitForURL("**/welkom", { timeout: 20000 }).catch(() => {});
    ok(
      new URL(pA.url()).pathname === "/welkom",
      "A zonder project komt op /welkom",
    );
    await pA.getByLabel("Naam van het project").fill(`E2E-project ${sfx}`);
    // Datumveld: vrij typen ("15-5-27") wordt 15-05-2027, ook in een
    // Engelstalige browser.
    const oplevering = pA.getByLabel("Verwachte oplevering (optioneel)");
    await oplevering.fill("15-5-27");
    await oplevering.blur();
    ok(
      (await oplevering.inputValue()) === "15-05-2027",
      "datumveld toont getypte datum als DD-MM-JJJJ",
    );
    await pA.getByRole("button", { name: "Project aanmaken" }).click();
    await pA.waitForURL("**/dashboard", { timeout: 20000 });
    ok(
      await pA.getByText(`E2E-project ${sfx}`).first().isVisible(),
      "A ziet het nieuwe project op het dashboard",
    );
    ok(
      (await pA.getByText("Oplevering 15-05-2027").count()) > 0,
      "opleverdatum opgeslagen en getoond als 15-05-2027",
    );
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/e2e-dashboard.png`,
        fullPage: true,
      });

    // Ongeldige datum (31 februari) wordt geweigerd, lokaal én door de server.
    await pA.goto(`${APP}/instellingen`);
    const datumVeld = pA.getByLabel("Verwachte oplevering", { exact: true });
    ok(
      (await datumVeld.inputValue()) === "15-05-2027",
      "instellingen tonen de opleverdatum als DD-MM-JJJJ",
    );
    await datumVeld.fill("31-02-2027");
    await datumVeld.blur();
    ok(
      (await pA.getByText("Gebruik DD-MM-JJJJ").count()) > 0,
      "ongeldige datum geeft direct een melding",
    );
    await pA.getByRole("button", { name: "Opslaan" }).first().click();
    await pA.waitForLoadState("networkidle");
    await pA.reload();
    ok(
      (await pA
        .getByLabel("Verwachte oplevering", { exact: true })
        .inputValue()) === "15-05-2027",
      "server weigert ongeldige datum (opgeslagen datum ongewijzigd)",
    );

    await pA.goto(`${APP}/instellingen`);
    await pA.getByLabel("E-mailadres").fill(accounts.b.email);
    await pA.getByLabel("Rol", { exact: true }).selectOption("bewerker");
    await pA.getByRole("button", { name: "Uitnodigen" }).click();
    const linkTekst = await pA
      .locator("code")
      .first()
      .textContent({ timeout: 20000 });
    ok(
      /\/uitnodiging\/[0-9a-f]{64}$/.test(linkTekst ?? ""),
      "uitnodigingslink gemaakt",
    );
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/e2e-uitnodigen.png`,
        fullPage: true,
      });
    const link = `${APP}${new URL(linkTekst).pathname}`;

    // --- C probeert de link als eerste --------------------------------------
    console.log("→ C (geen toegang) probeert de uitnodiging van B");
    const pC = await pagina(accounts.c);
    await pC.goto(link);
    ok(
      (await pC.getByText("deze uitnodiging is voor").count()) > 0 &&
        (await pC
          .getByRole("button", { name: "Uitnodiging accepteren" })
          .count()) === 0,
      "C kan de uitnodiging voor B niet accepteren",
    );

    // --- B: inloggen, uitnodiging accepteren --------------------------------
    console.log("→ B: inloggen en uitnodiging accepteren");
    const pB = await pagina(accounts.b);
    await pB.goto(link);
    await pB.getByRole("button", { name: "Uitnodiging accepteren" }).click();
    await pB.waitForURL("**/dashboard", { timeout: 20000 });
    ok(
      await pB.getByText(`E2E-project ${sfx}`).first().isVisible(),
      "B ziet na accepteren hetzelfde project",
    );
    await pB.goto(`${APP}/instellingen`);
    ok(
      (await pB.getByText("E2E A").count()) > 0 &&
        (await pB.getByText("E2E B").count()) > 0,
      "B ziet beide leden in Instellingen",
    );
    ok(
      (await pB.getByRole("button", { name: "Uitnodigen" }).count()) === 0,
      "B (bewerker) krijgt geen uitnodigformulier",
    );
    if (SCREENSHOTS)
      await pB.screenshot({
        path: `${SCREENSHOTS}/e2e-instellingen-b.png`,
        fullPage: true,
      });

    await pC.goto(link);
    ok(
      (await pC.getByText("al gebruikt").count()) > 0,
      "gebruikte link werkt niet meer",
    );

    // --- Gegevens via de API (zelfde rechten als de app) ---------------------
    console.log("→ Gegevens vergelijken via de API");
    const inloggen = async (acc) => {
      const c = createClient(URL_SB, publishable, geenSessie);
      const { error } = await c.auth.signInWithPassword({
        email: acc.email,
        password: acc.wachtwoord,
      });
      if (error) throw error;
      return c;
    };
    clientA = await inloggen(accounts.a);
    const clientB = await inloggen(accounts.b);
    const clientC = await inloggen(accounts.c);

    const { data: projA } = await clientA.from("projects").select("id, name");
    projectId = projA?.[0]?.id;
    ok(projA?.length === 1, "A ziet precies één project");

    const r1 = await clientA
      .from("categories")
      .insert({ project_id: projectId, name: "Keuken" });
    const r2 = await clientB
      .from("suppliers")
      .insert({ project_id: projectId, name: "Leverancier van B" });
    ok(!r1.error && !r2.error, "A en B kunnen allebei gegevens toevoegen");

    const tabellen = [
      "projects",
      "project_members",
      "categories",
      "suppliers",
      "profiles",
    ];
    const zicht = async (c) => {
      const uit = {};
      for (const t of tabellen) {
        const { data, error } = await c.from(t).select("*").order("created_at");
        if (error) throw new Error(`${t}: ${error.message}`);
        uit[t] = data;
      }
      return uit;
    };
    const zichtA = await zicht(clientA);
    const zichtB = await zicht(clientB);
    ok(
      JSON.stringify(zichtA) === JSON.stringify(zichtB),
      "A en B zien exact dezelfde gegevens (project, leden, categorieën, leveranciers, profielen)",
    );
    ok(
      zichtA.categories.length === 1 && zichtA.suppliers.length === 1,
      "beide toevoegingen zichtbaar",
    );

    const zichtC = await zicht(clientC);
    ok(
      zichtC.projects.length === 0 &&
        zichtC.project_members.length === 0 &&
        zichtC.categories.length === 0 &&
        zichtC.suppliers.length === 0 &&
        zichtC.profiles.length === 1,
      "C ziet niets van het project (alleen het eigen profiel)",
    );
    const inbraak = await clientC
      .from("categories")
      .insert({ project_id: projectId, name: "Inbraak" });
    ok(Boolean(inbraak.error), "C kan niets toevoegen aan het project");
    const wijzig = await clientC
      .from("categories")
      .update({ name: "gehackt" })
      .eq("project_id", projectId)
      .select();
    ok(!wijzig.error && wijzig.data.length === 0, "C kan niets wijzigen");
    const uitnodigB = await clientB.rpc("create_invite", {
      p_project: projectId,
      p_email: "iemand@example.com",
      p_role: "lezer",
    });
    ok(Boolean(uitnodigB.error), "B (bewerker) kan niet uitnodigen");

    const anon = createClient(URL_SB, publishable, geenSessie);
    const anonLees = await anon.from("projects").select("id");
    ok(
      Boolean(anonLees.error) || anonLees.data.length === 0,
      "niet ingelogd: geen toegang tot projecten",
    );

    const pAnon = await (await browser.newContext()).newPage();
    await pAnon.goto(`${APP}/dashboard`);
    ok(
      new URL(pAnon.url()).pathname === "/inloggen",
      "niet ingelogd: app stuurt naar inloggen",
    );
  } finally {
    console.log("→ Opruimen");
    if (browser) await browser.close();
    if (clientA && projectId) {
      await clientA.from("projects").delete().eq("id", projectId);
    }
    for (const id of ids) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error)
        console.error(`  ! account ${id} niet verwijderd: ${error.message}`);
    }
    const rest = await sql(`
      select (select count(*) from auth.users where email like 'e2e-%-${sfx}@example.com') as accounts,
             (select count(*) from public.projects where name = 'E2E-project ${sfx}') as projecten`);
    ok(
      Number(rest[0].accounts) === 0 && Number(rest[0].projecten) === 0,
      "testaccounts en testproject volledig verwijderd",
    );
  }

  console.log(`\n✓ End-to-end test geslaagd (${geslaagd} controles).`);
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
