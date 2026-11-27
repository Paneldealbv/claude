#!/usr/bin/env node
/**
 * End-to-end test via de echte app tegen het echte Supabase-project.
 *
 * Maakt drie tijdelijke testaccounts (A, B, C) en doorloopt:
 *   A logt in → maakt project → nodigt B uit
 *   B logt in → accepteert uitnodiging → ziet hetzelfde project en dezelfde gegevens
 *   budget, categorieën en ruimtes (fase 4)
 *   leveranciers, offertes met PDF, vergelijken, accepteren → contract,
 *   meer-/minderwerk, termijnschema en status (fase 5)
 *   facturen, bonnen en betalingen (fase 6), dashboard en rapportages (fase 7)
 *   AI-documentherkenning (fase 8): uploaden en foto verkleinen, het
 *   controlescherm met een vast testvoorstel, boeken na bevestiging,
 *   verplichte velden, voorstel verwijderen; met AI-sleutel ook een echte
 *   herkenning van een testfactuur
 *   C (geen toegang) ziet niets en kan niets wijzigen, ook geen bestanden
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
import { deflateSync } from "node:zlib";
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

/** Kleine, geldige PDF met één regel tekst, of meerdere regels (factuur). */
function maakPdf(tekst) {
  const objecten = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null, // inhoud
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const veilig = (t) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const inhoud = Array.isArray(tekst)
    ? tekst
        .map(
          (t, i) => `BT /F1 11 Tf 60 ${780 - i * 18} Td (${veilig(t)}) Tj ET`,
        )
        .join("\n")
    : `BT /F1 24 Tf 72 760 Td (${veilig(tekst)}) Tj ET`;
  objecten[3] = `<< /Length ${inhoud.length} >>\nstream\n${inhoud}\nendstream`;
  let pdf = "%PDF-1.4\n";
  const posities = [];
  objecten.forEach((o, i) => {
    posities.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objecten.length + 1}\n0000000000 65535 f \n`;
  for (const pos of posities)
    pdf += `${String(pos).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objecten.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Grote PNG (licht papier met ruis), zoals een foto van een telefoon. */
function maakPng(breedte, hoogte) {
  const rijen = [];
  for (let y = 0; y < hoogte; y++) {
    const rij = randomBytes(1 + breedte * 3);
    rij[0] = 0;
    for (let i = 1; i < rij.length; i++) rij[i] = 240 | (rij[i] & 15);
    rijen.push(rij);
  }
  const blok = (type, data) => {
    const lengte = Buffer.alloc(4);
    lengte.writeUInt32BE(data.length);
    const inhoud = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(inhoud));
    return Buffer.concat([lengte, inhoud, crc]);
  };
  const kop = Buffer.alloc(13);
  kop.writeUInt32BE(breedte, 0);
  kop.writeUInt32BE(hoogte, 4);
  kop[8] = 8; // bits per kanaal
  kop[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blok("IHDR", kop),
    blok("IDAT", deflateSync(Buffer.concat(rijen))),
    blok("IEND", Buffer.alloc(0)),
  ]);
}

/** Testfactuur voor de echte AI-herkenning (alleen met AI-sleutel). */
const TESTFACTUUR = [
  "Bouwbedrijf Testmans B.V.",
  "Industrieweg 12, 1234 AB Voorbeeld",
  "KvK 24681357 - BTW NL002468135B01 - IBAN NL20INGB0001234567",
  "",
  "FACTUUR",
  "Factuurnummer: TM-2026-0042",
  "Factuurdatum: 12-11-2026",
  "Vervaldatum: 26-11-2026",
  "",
  "Omschrijving                 Excl. BTW     BTW 21%     Incl. BTW",
  "Tegelwerk badkamer           1.000,00      210,00      1.210,00",
  "Kitwerk badkamer               100,00       21,00        121,00",
  "",
  "Totaal excl. BTW: EUR 1.100,00",
  "BTW 21%: EUR 231,00",
  "Totaal te betalen: EUR 1.331,00",
];

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
      // Vlak na een deploy kan het allereerste verzoek naar een testversie op
      // Vercel lang blijven hangen. De volgende stappen wachten zelf op wat ze
      // nodig hebben, dus hier niet afbreken.
      await p
        .waitForLoadState("networkidle", { timeout: 30000 })
        .catch(() =>
          console.log("  (pagina nog niet helemaal rustig; verder)"),
        );
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

    // API-clients met dezelfde rechten als de app.
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

    // --- Fase 4: budget, categorieën en ruimtes via de app --------------------
    console.log("→ Budget, categorieën en ruimtes");
    const formMet = (p, veld) => p.locator("form", { has: p.getByLabel(veld) });
    const openCategorie = async (p, naam) => {
      await p.goto(`${APP}/budget`);
      await p.getByRole("link", { name: naam, exact: true }).click();
      await p.waitForURL(/\/budget\/[0-9a-f-]{36}$/, { timeout: 20000 });
      await p
        .getByRole("heading", { level: 1, name: naam, exact: true })
        .waitFor();
      return new URL(p.url()).pathname.split("/").pop();
    };

    await pA.goto(`${APP}/budget`);
    if (SCREENSHOTS)
      await pA.screenshot({ path: `${SCREENSHOTS}/budget-leeg.png` });
    await pA
      .getByRole("button", { name: "Standaardindeling gebruiken" })
      .click();
    await pA
      .getByRole("heading", { name: "Categorieën", exact: true })
      .waitFor({ timeout: 20000 });
    ok(
      (await pA.getByRole("link", { name: "Keuken", exact: true }).count()) ===
        1 &&
        (await pA
          .getByRole("link", { name: "Onvoorzien", exact: true })
          .count()) === 1,
      "standaardindeling aangemaakt",
    );

    const keukenId = await openCategorie(pA, "Keuken");
    const nieuweRegel = formMet(pA, "Bedrag incl. BTW").last();
    for (const [omschrijving, bedrag] of [
      ["Keukenkasten", "15.000"],
      ["Apparatuur", "9000"],
    ]) {
      await nieuweRegel.getByLabel("Omschrijving").fill(omschrijving);
      await nieuweRegel.getByLabel("Bedrag incl. BTW").fill(bedrag);
      await nieuweRegel.getByRole("button", { name: "Toevoegen" }).click();
      await pA
        .getByText(omschrijving, { exact: true })
        .waitFor({ timeout: 20000 });
    }
    await pA.getByText("€ 24.000").first().waitFor({ timeout: 20000 });
    ok(true, "budgetregels toegevoegd (€ 15.000 + € 9.000 = € 24.000)");

    await pA.getByRole("button", { name: "Wijzig Apparatuur" }).click();
    const bewerkRegel = formMet(pA, "Bedrag incl. BTW").first();
    await bewerkRegel.getByLabel("Bedrag incl. BTW").fill("10.000");
    await bewerkRegel.getByRole("button", { name: "Opslaan" }).click();
    await pA.getByText("€ 25.000").first().waitFor({ timeout: 20000 });
    ok(true, "budgetregel gewijzigd (totaal € 25.000)");
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/budget-keuken.png`,
        fullPage: true,
      });

    const { data: keukenRegels } = await clientA
      .from("budget_lines")
      .select("amount_excl_cents, vat_cents, amount_incl_cents, vat_rate_bp")
      .eq("category_id", keukenId)
      .order("amount_incl_cents");
    ok(
      JSON.stringify(keukenRegels) ===
        JSON.stringify([
          {
            amount_excl_cents: 826446,
            vat_cents: 173554,
            amount_incl_cents: 1000000,
            vat_rate_bp: 2100,
          },
          {
            amount_excl_cents: 1239669,
            vat_cents: 260331,
            amount_incl_cents: 1500000,
            vat_rate_bp: 2100,
          },
        ]),
      "budgetregels opgeslagen met excl., BTW en incl. tot op de cent",
    );

    // Afsluiten zonder waarschuwingen, en weer heropenen.
    await openCategorie(pA, "Onvoorzien");
    await pA.getByRole("button", { name: "Categorie afsluiten" }).click();
    await pA.getByText(/^Afgesloten op /).waitFor({ timeout: 20000 });
    ok(true, "categorie zonder openstaande zaken direct afgesloten");
    await pA.getByRole("button", { name: "Heropenen" }).click();
    await pA
      .getByRole("button", { name: "Categorie afsluiten" })
      .waitFor({ timeout: 20000 });
    ok(true, "categorie heropend");

    // Afsluiten mét waarschuwing: een document dat nog gecontroleerd moet worden.
    const meubelsId = await openCategorie(pA, "Meubels");
    const { data: controleDoc } = await clientA
      .from("cost_documents")
      .insert({
        project_id: projectId,
        type: "bon",
        status: "te_controleren",
        document_date: "2026-11-20",
      })
      .select("id")
      .single();
    await clientA.from("cost_lines").insert({
      project_id: projectId,
      cost_document_id: controleDoc.id,
      category_id: meubelsId,
      amount_excl_cents: 10000,
      vat_rate_bp: 2100,
      vat_cents: 2100,
      amount_incl_cents: 12100,
    });
    await pA.reload();
    ok(
      (await pA
        .getByText("1 document moet nog gecontroleerd worden")
        .count()) === 1,
      "afsluitcontrole waarschuwt voor een document in controle",
    );
    await pA.getByRole("button", { name: "Categorie afsluiten" }).click();
    await pA
      .getByText("Vink aan dat je de waarschuwingen hebt gelezen.")
      .waitFor({ timeout: 20000 });
    ok(true, "afsluiten met waarschuwingen vraagt om bevestiging");
    await pA.getByLabel(/Ik heb de waarschuwingen gelezen/).check();
    await pA.getByRole("button", { name: "Categorie afsluiten" }).click();
    await pA.getByText(/^Afgesloten op /).waitFor({ timeout: 20000 });
    const { data: log } = await clientA
      .from("activity_log")
      .select("action, changes")
      .eq("record_id", meubelsId)
      .eq("action", "categorie_afgesloten");
    ok(
      log?.[0]?.changes?.waarschuwingen_bevestigd?.length === 1,
      "afsluiten na bevestiging, vastgelegd in het activiteitenlog",
    );
    await clientA.from("cost_documents").delete().eq("id", controleDoc.id);

    // Subcategorie toevoegen, hernoemen en verwijderen.
    const buitenId = await openCategorie(pA, "Buiten");
    const subForm = formMet(pA, "Nieuwe subcategorie");
    await subForm.getByLabel("Nieuwe subcategorie").fill("Zonwering");
    await subForm.getByRole("button", { name: "Toevoegen" }).click();
    await pA
      .getByRole("link", { name: /Zonwering/ })
      .waitFor({ timeout: 20000 });
    await pA.getByRole("link", { name: /Zonwering/ }).click();
    await pA
      .getByRole("heading", { level: 1, name: "Zonwering" })
      .waitFor({ timeout: 20000 });
    await formMet(pA, "Naam").getByLabel("Naam").fill("Zonwering & screens");
    await formMet(pA, "Naam").getByRole("button", { name: "Opslaan" }).click();
    await pA
      .getByRole("heading", { level: 1, name: "Zonwering & screens" })
      .waitFor({ timeout: 20000 });
    await pA.getByLabel(/Ja, verwijder/).check();
    await pA.getByRole("button", { name: "Categorie verwijderen" }).click();
    await pA.waitForURL(`**/budget/${buitenId}`, { timeout: 20000 });
    ok(
      (await pA.getByRole("link", { name: /Zonwering/ }).count()) === 0,
      "subcategorie toegevoegd, hernoemd en verwijderd",
    );

    await pA.goto(`${APP}/budget`);
    if (SCREENSHOTS) {
      await pA.screenshot({
        path: `${SCREENSHOTS}/budget-overzicht.png`,
        fullPage: true,
      });
      await pA.setViewportSize({ width: 390, height: 844 });
      await pA.screenshot({
        path: `${SCREENSHOTS}/budget-mobiel.png`,
        fullPage: true,
      });
      await pA.setViewportSize({ width: 1440, height: 900 });
    }

    // Ruimtes.
    await pA.goto(`${APP}/ruimtes`);
    await pA
      .getByRole("button", { name: "Standaardruimtes gebruiken" })
      .click();
    await pA
      .getByRole("heading", { name: "12 ruimtes", exact: true })
      .waitFor({ timeout: 20000 });
    const nieuweRuimte = formMet(pA, "Verdieping (optioneel)").last();
    await nieuweRuimte.getByLabel("Naam").fill("Werkkamer");
    await nieuweRuimte
      .getByLabel("Verdieping (optioneel)")
      .fill("Eerste verdieping");
    await nieuweRuimte
      .getByRole("button", { name: "Ruimte toevoegen" })
      .click();
    await pA
      .getByRole("heading", { name: "13 ruimtes", exact: true })
      .waitFor({ timeout: 20000 });
    await pA.getByRole("button", { name: "Wijzig Werkkamer" }).click();
    const bewerkRuimte = formMet(pA, "Verdieping (optioneel)").first();
    await bewerkRuimte.getByLabel("Naam").fill("Kantoor");
    await bewerkRuimte.getByRole("button", { name: "Opslaan" }).click();
    await pA.getByText("Kantoor", { exact: true }).waitFor({ timeout: 20000 });
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/ruimtes.png`,
        fullPage: true,
      });
    await pA.getByRole("button", { name: "Verwijder Kantoor" }).click();
    await pA
      .getByRole("heading", { name: "12 ruimtes", exact: true })
      .waitFor({ timeout: 20000 });
    ok(true, "ruimtes: standaard, toevoegen, wijzigen en verwijderen");

    // --- Fase 5: leveranciers, offertes en contracten ------------------------
    console.log("→ Leveranciers, offertes en contracten");
    const uuidEind = (pad) =>
      new RegExp(`${pad}/[0-9a-f-]{36}$`.replaceAll("/", "\\/"));
    const idUitUrl = (p) => new URL(p.url()).pathname.split("/").pop();

    // Leverancier via de leverancierspagina.
    await pA.goto(`${APP}/leveranciers`);
    const levForm = formMet(pA, "IBAN");
    await levForm
      .getByLabel("Naam", { exact: true })
      .fill("Keukenstudio Noord");
    await levForm.getByLabel("IBAN").fill("nl91 abna 0417 1643 00");
    await levForm.getByLabel("KvK-nummer").fill("12345678");
    await levForm
      .getByRole("button", { name: "Leverancier toevoegen" })
      .click();
    await pA.waitForURL(uuidEind("/leveranciers"), { timeout: 20000 });
    const leverancierId = idUitUrl(pA);
    const { data: lev } = await clientA
      .from("suppliers")
      .select("name, iban, kvk_number")
      .eq("id", leverancierId)
      .single();
    ok(
      lev?.iban === "NL91ABNA0417164300" && lev.kvk_number === "12345678",
      "leverancier toegevoegd (IBAN genormaliseerd)",
    );

    // Offerte 1: twee regels en een PDF.
    const pdf = maakPdf("Offerte keuken");
    await pA.goto(`${APP}/offertes/nieuw?leverancier=${leverancierId}`);
    ok(
      (await pA.getByLabel("Leverancier", { exact: true }).inputValue()) ===
        leverancierId,
      "nieuwe offerte vanaf de leverancier: leverancier staat al ingevuld",
    );
    await pA.getByLabel("Titel", { exact: true }).fill("Keuken compleet");
    await pA.getByLabel("Offertenummer (optioneel)").fill("OF-2026-118");
    await pA.getByLabel("Offertedatum (optioneel)").fill("12-11-2026");
    await pA.getByLabel("Geldig tot (optioneel)").fill("31-12-2026");
    await pA.locator('input[type="file"]').setInputFiles({
      name: "offerte-keuken.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await pA
      .getByText("offerte-keuken.pdf", { exact: true })
      .waitFor({ timeout: 30000 });
    await pA.getByLabel("Omschrijving regel 1").fill("Keukenblok met werkblad");
    await pA
      .getByLabel("Categorie regel 1")
      .selectOption({ label: "Afbouw › Keuken" });
    await pA.getByLabel("Bedrag regel 1").fill("21.350");
    await pA.getByRole("button", { name: "Regel toevoegen" }).click();
    await pA.getByLabel("Omschrijving regel 2").fill("Apparatuur");
    await pA
      .getByLabel("Categorie regel 2")
      .selectOption({ label: "Afbouw › Keuken" });
    await pA.getByLabel("Bedrag regel 2").fill("5000");
    await pA.getByText("€ 26.350,00").waitFor();
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/offerte-nieuw.png`,
        fullPage: true,
      });
    await pA.getByRole("button", { name: "Offerte opslaan" }).click();
    await pA.waitForURL(uuidEind("/offertes"), { timeout: 20000 });
    const offerte1 = idUitUrl(pA);
    await pA
      .getByRole("heading", { level: 1, name: "Keuken compleet" })
      .waitFor();
    const { data: q1 } = await clientA
      .from("quotes")
      .select(
        "status, quote_number, quote_date, valid_until, file_id, quote_lines (amount_incl_cents, amount_excl_cents, vat_cents)",
      )
      .eq("id", offerte1)
      .single();
    ok(
      q1.status === "ontvangen" &&
        q1.quote_number === "OF-2026-118" &&
        q1.quote_date === "2026-11-12" &&
        q1.valid_until === "2026-12-31" &&
        q1.file_id &&
        q1.quote_lines
          .map((l) => l.amount_incl_cents)
          .sort((a, b) => a - b)
          .join() === "500000,2135000" &&
        q1.quote_lines.every(
          (l) => l.amount_excl_cents + l.vat_cents === l.amount_incl_cents,
        ),
      "offerte opgeslagen met datums, PDF en twee regels (excl. + BTW = incl.)",
    );

    // De PDF staat in de privé opslag en is via een tijdelijke link te zien.
    const bekijkLink = await pA.locator("iframe").getAttribute("src");
    const pdfAntwoord = await fetch(bekijkLink);
    ok(
      pdfAntwoord.ok &&
        pdfAntwoord.headers.get("content-type") === "application/pdf" &&
        Buffer.from(await pdfAntwoord.arrayBuffer()).equals(pdf),
      "PDF via tijdelijke link te bekijken (zelfde bestand)",
    );
    const xfo = pdfAntwoord.headers.get("x-frame-options");
    const csp = pdfAntwoord.headers.get("content-security-policy");
    if (xfo || csp)
      console.log(`  (bestandslink: x-frame-options=${xfo} csp=${csp})`);

    // Nog niet geaccepteerd: het budget verandert niet, wel het voorbeeld.
    const effect = pA.getByRole("table", { name: /Prognose per categorie/ });
    ok(
      (await effect.getByRole("row", { name: /Afbouw › Keuken/ }).innerText())
        .replace(/\s+/g, " ")
        .includes("€ 25.000 € 26.350"),
      "voorbeeld vóór accepteren: Keuken van € 25.000 naar € 26.350",
    );
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/offerte-detail.png`,
        fullPage: true,
      });

    // Offerte 2: nieuwe leverancier direct in het formulier, zelfde PDF.
    await pA.goto(`${APP}/offertes/nieuw`);
    await pA
      .getByLabel("Leverancier", { exact: true })
      .selectOption("__nieuw__");
    await pA.getByLabel("Naam nieuwe leverancier").fill("Keuken & Co");
    await pA.getByLabel("Titel", { exact: true }).fill("Keuken basis");
    await pA.locator('input[type="file"]').setInputFiles({
      name: "kopie.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await pA
      .getByText("Dit bestand stond al in je project", { exact: false })
      .waitFor({ timeout: 30000 });
    ok(true, "dubbel bestand herkend: het bestaande bestand wordt gebruikt");
    await pA.getByLabel("Omschrijving regel 1").fill("Keuken incl. apparatuur");
    await pA
      .getByLabel("Categorie regel 1")
      .selectOption({ label: "Afbouw › Keuken" });
    await pA.getByLabel("Bedrag regel 1").fill("24.900");
    await pA.getByRole("button", { name: "Offerte opslaan" }).click();
    await pA.waitForURL(uuidEind("/offertes"), { timeout: 20000 });
    const offerte2 = idUitUrl(pA);
    const { data: q2 } = await clientA
      .from("quotes")
      .select("file_id, suppliers (name)")
      .eq("id", offerte2)
      .single();
    ok(
      q2.suppliers?.name === "Keuken & Co" && q2.file_id === q1.file_id,
      "tweede offerte met nieuwe leverancier en hetzelfde (ene) bestand",
    );

    // Vergelijken per categorie: goedkoopste eerst.
    await pA.goto(`${APP}/offertes?weergave=vergelijk`);
    const vergelijk = pA.getByRole("region", { name: "Afbouw › Keuken" });
    const rijen = vergelijk.getByRole("listitem");
    ok(
      (await rijen.count()) === 2 &&
        (await rijen.first().innerText()).includes("Keuken & Co") &&
        (await rijen.first().innerText()).includes("Laagste"),
      "vergelijking: Keuken & Co (€ 24.900) als laagste boven Keukenstudio Noord",
    );
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/offertes-vergelijk.png`,
        fullPage: true,
      });

    // Offerte 2 afwijzen.
    await pA.goto(`${APP}/offertes/${offerte2}`);
    await pA.getByRole("button", { name: "Afwijzen" }).click();
    await pA
      .getByRole("button", { name: "Terug naar ontvangen" })
      .waitFor({ timeout: 20000 });
    await pA.goto(`${APP}/offertes?status=afgewezen`);
    ok(
      (await pA.getByRole("link", { name: /Keuken basis/ }).count()) === 1 &&
        (await pA.getByRole("link", { name: /Keuken compleet/ }).count()) === 0,
      "offerte afgewezen; filter op status werkt",
    );

    // Offerte 1 accepteren → contract.
    await pA.goto(`${APP}/offertes/${offerte1}`);
    await pA.getByLabel("Getekend op (optioneel)").fill("20-11-2026");
    await pA
      .getByRole("button", { name: "Accepteren en contract maken" })
      .click();
    await pA.waitForURL(uuidEind("/contracten"), { timeout: 20000 });
    const contractId = idUitUrl(pA);
    const { data: k1 } = await clientA
      .from("contracts")
      .select(
        "quote_id, signed_on, status, supplier_id, contract_lines (amount_incl_cents, category_id)",
      )
      .eq("id", contractId)
      .single();
    const { data: q1na } = await clientA
      .from("quotes")
      .select("status")
      .eq("id", offerte1)
      .single();
    ok(
      k1.quote_id === offerte1 &&
        k1.signed_on === "2026-11-20" &&
        k1.status === "actief" &&
        k1.supplier_id === leverancierId &&
        k1.contract_lines
          .map((l) => l.amount_incl_cents)
          .sort((a, b) => a - b)
          .join() === "500000,2135000" &&
        k1.contract_lines.every((l) => l.category_id === keukenId) &&
        q1na.status === "geaccepteerd",
      "offerte geaccepteerd: contract met dezelfde regels, offerte op geaccepteerd",
    );
    const dubbel = await clientA.from("contracts").insert({
      project_id: projectId,
      quote_id: offerte1,
      title: "Dubbel",
    });
    ok(
      Boolean(dubbel.error),
      "een offerte kan maar één keer een contract worden",
    );

    const tegel = (p, label) =>
      p
        .getByRole("region", { name: "Kerncijfers" })
        .locator("div", { has: p.getByText(label, { exact: true }) })
        .last();
    const tegelTekst = async (p, label) =>
      (await tegel(p, label).innerText()).replace(/\s+/g, " ");
    await openCategorie(pA, "Keuken");
    ok(
      (await tegelTekst(pA, "Prognose")).includes("€ 26.350") &&
        (await pA.getByRole("link", { name: /Keuken compleet/ }).count()) === 1,
      "budget Keuken: prognose € 26.350 (contract telt nu mee, één keer)",
    );

    // Meer- en minderwerk.
    await pA.goto(`${APP}/contracten/${contractId}`);
    const wijzigForm = pA.locator("form", { has: pA.getByLabel("Bij regel") });
    await wijzigForm
      .getByLabel("Bij regel")
      .selectOption({ label: "Apparatuur (Afbouw › Keuken)" });
    await wijzigForm.getByLabel("Omschrijving").fill("Close-in boiler");
    await wijzigForm.getByLabel("Bedrag incl. BTW").fill("650");
    await wijzigForm
      .getByRole("button", { name: "Meer- of minderwerk toevoegen" })
      .click();
    await pA
      .getByText("Toegevoegd als voorstel", { exact: false })
      .waitFor({ timeout: 20000 });
    ok(
      (await tegelTekst(pA, "Gecontracteerd")).includes("€ 26.350"),
      "voorgesteld meerwerk telt nog niet mee",
    );
    await pA.getByRole("button", { name: "Akkoord" }).click();
    await pA
      .getByRole("button", { name: "Terug naar voorstel" })
      .waitFor({ timeout: 20000 });
    ok(
      (await tegelTekst(pA, "Gecontracteerd")).includes("€ 27.000"),
      "meerwerk na akkoord: gecontracteerd € 27.000",
    );
    await wijzigForm
      .getByLabel("Bij regel")
      .selectOption({ label: "Keukenblok met werkblad (Afbouw › Keuken)" });
    await wijzigForm.getByLabel("Omschrijving").fill("Andere grepen");
    await wijzigForm.getByLabel("Bedrag incl. BTW").fill("-250");
    await wijzigForm
      .getByRole("button", { name: "Meer- of minderwerk toevoegen" })
      .click();
    await pA
      .getByRole("button", { name: "Afwijzen" })
      .waitFor({ timeout: 20000 });
    await pA.getByRole("button", { name: "Afwijzen" }).click();
    await pA
      .getByRole("button", { name: "Terug naar voorstel" })
      .nth(1)
      .waitFor({ timeout: 20000 });
    const { data: wijzigingen } = await clientA
      .from("contract_changes")
      .select("status, amount_incl_cents, decided_at, decided_by")
      .order("created_at");
    ok(
      wijzigingen.length === 2 &&
        wijzigingen[0].status === "akkoord" &&
        wijzigingen[0].amount_incl_cents === 65000 &&
        wijzigingen[0].decided_by === ids[0] &&
        wijzigingen[0].decided_at &&
        wijzigingen[1].status === "afgewezen" &&
        wijzigingen[1].amount_incl_cents === -25000 &&
        (await tegelTekst(pA, "Gecontracteerd")).includes("€ 27.000"),
      "minderwerk afgewezen telt niet mee; besluiten vastgelegd met wie en wanneer",
    );

    // Termijnschema 30% / 70%.
    const termijnForm = pA.locator("form", {
      has: pA.getByPlaceholder("Bijv. bij start bouw"),
    });
    const termijn = async (omschrijving, percentage, datum) => {
      await termijnForm.getByLabel("Omschrijving").fill(omschrijving);
      await termijnForm
        .getByLabel("Percentage", { exact: true })
        .fill(percentage);
      if (datum)
        await termijnForm.getByLabel("Verwacht (optioneel)").fill(datum);
      await termijnForm
        .getByRole("button", { name: "Termijn toevoegen" })
        .click();
    };
    await termijn("Aanbetaling", "30", "01-12-2026");
    await pA.locator("ol").getByText("€ 8.100,00").waitFor({ timeout: 20000 });
    await termijn("Bij oplevering", "70");
    await pA.locator("ol").getByText("€ 18.900,00").waitFor({ timeout: 20000 });
    ok(
      (await pA.locator("p", { hasText: "Ingepland" }).innerText())
        .replace(/\s+/g, " ")
        .includes("€ 27.000,00 van € 27.000,00 (100%)"),
      "termijnen 30% + 70% = € 8.100 + € 18.900 = het hele contract",
    );
    await termijn("Extra", "10");
    await pA
      .getByText("Het termijnschema is al 100%.")
      .waitFor({ timeout: 20000 });
    ok(true, "termijnschema kan niet boven 100% uitkomen");

    // Ruimte bij een contractregel.
    await pA.getByRole("button", { name: "Ruimtes regel 1" }).click();
    await pA.getByLabel("Keuken", { exact: true }).check();
    await pA.getByRole("button", { name: "Ruimtes opslaan" }).click();
    // Tijdens het opslaan heet de knop "Opslaan…"; wacht daarom tot het
    // hele paneel dicht is (dat gebeurt pas na succes).
    await pA
      .getByRole("group", { name: "Ruimtes" })
      .waitFor({ state: "detached", timeout: 20000 });
    const { data: verdeling, error: verdelingFout } = await clientA
      .from("room_allocations")
      .select("share_bp, rooms (name)")
      .not("contract_line_id", "is", null);
    ok(
      verdeling.length === 1 &&
        verdeling[0].share_bp === 10000 &&
        verdeling[0].rooms?.name === "Keuken",
      `contractregel aan de ruimte Keuken gekoppeld (100%)${verdeling?.length === 1 && verdeling[0].share_bp === 10000 && verdeling[0].rooms?.name === "Keuken" ? "" : ` — kreeg ${JSON.stringify(verdeling)} ${verdelingFout?.message ?? ""}`}`,
    );
    if (SCREENSHOTS) {
      await pA.screenshot({
        path: `${SCREENSHOTS}/contract-detail.png`,
        fullPage: true,
      });
      await pA.setViewportSize({ width: 390, height: 844 });
      await pA.screenshot({
        path: `${SCREENSHOTS}/contract-mobiel.png`,
        fullPage: true,
      });
      await pA.setViewportSize({ width: 1440, height: 900 });
    }

    // Status: afgerond (prognose = gefactureerd) en weer actief.
    await pA.getByLabel(/^Afgerond/).check();
    const statusWaarschuwing = pA.getByText(
      /Dat bedrag telt daarna niet meer mee/,
    );
    await statusWaarschuwing.waitFor({ timeout: 20000 });
    ok(
      (await statusWaarschuwing.innerText())
        .replace(/\s+/g, " ")
        .includes("Er staat nog € 27.000 te factureren"),
      "afronden waarschuwt dat het nog niet gefactureerde deel uit de prognose valt",
    );
    await pA.getByRole("button", { name: "Status opslaan" }).click();
    await pA.getByText("Status bijgewerkt.").waitFor({ timeout: 20000 });
    await openCategorie(pA, "Keuken");
    ok(
      (await tegelTekst(pA, "Prognose")).includes("€ 25.000"),
      "contract afgerond zonder facturen: Keuken valt terug op het budget",
    );
    await pA.goto(`${APP}/contracten/${contractId}`);
    await pA.getByLabel(/^Actief/).check();
    await pA.getByRole("button", { name: "Status opslaan" }).click();
    await pA.getByText("Status bijgewerkt.").waitFor({ timeout: 20000 });
    const { data: statusLog } = await clientA
      .from("activity_log")
      .select("changes")
      .eq("record_id", contractId)
      .eq("action", "contract_status")
      .order("created_at");
    ok(
      statusLog.length === 2 &&
        statusLog[0].changes.naar === "afgerond" &&
        statusLog[1].changes.naar === "actief",
      "statuswijzigingen vastgelegd in het activiteitenlog",
    );

    // Contract zonder offerte: categorie verplicht; daarna weer verwijderen.
    await pA.goto(`${APP}/contracten/nieuw`);
    await pA
      .getByLabel("Leverancier", { exact: true })
      .selectOption("__nieuw__");
    await pA
      .getByLabel("Naam nieuwe leverancier")
      .fill("Installatiebedrijf Oost");
    await pA
      .getByLabel("Naam van het contract")
      .fill("Extra groepen meterkast");
    await pA.getByLabel("Omschrijving regel 1").fill("Groepenkast uitbreiden");
    await pA.getByLabel("Bedrag regel 1").fill("1.850");
    await pA.getByRole("button", { name: "Contract opslaan" }).click();
    await pA
      .getByText("Kies bij regel 1 een categorie.")
      .waitFor({ timeout: 20000 });
    ok(
      (await pA.getByLabel("Naam van het contract").inputValue()) ===
        "Extra groepen meterkast",
      "contract zonder categorie geweigerd; ingevulde gegevens blijven staan",
    );
    await pA
      .getByLabel("Categorie regel 1")
      .selectOption({ label: "Afbouw › Verlichting & elektra" });
    await pA.getByRole("button", { name: "Contract opslaan" }).click();
    await pA.waitForURL(uuidEind("/contracten"), { timeout: 20000 });
    const handmatig = idUitUrl(pA);
    await pA.getByLabel(/Ja, verwijder/).check();
    await pA.getByRole("button", { name: "Contract verwijderen" }).click();
    await pA.waitForURL(`${APP}/contracten`, { timeout: 20000 });
    const { count: weg } = await clientA
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("id", handmatig);
    ok(weg === 0, "contract zonder offerte aangemaakt en weer verwijderd");
    await pA.reload();
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/contracten.png`,
        fullPage: true,
      });

    // Afgewezen offerte verwijderen: het gedeelde bestand blijft bewaard.
    await pA.goto(`${APP}/offertes/${offerte2}`);
    await pA.getByLabel(/Ja, verwijder/).check();
    await pA.getByRole("button", { name: "Offerte verwijderen" }).click();
    await pA.waitForURL(`${APP}/offertes`, { timeout: 20000 });
    const { data: bestanden } = await clientA
      .from("files")
      .select("id, storage_path");
    const opslagInfo = await clientA.storage
      .from("documenten")
      .info(bestanden?.[0]?.storage_path ?? "");
    ok(
      bestanden.length === 1 &&
        bestanden[0].id === q1.file_id &&
        !opslagInfo.error,
      "offerte verwijderd; het bestand van de andere offerte blijft bewaard",
    );
    const bestandPad = bestanden[0].storage_path;

    // B ziet hetzelfde contract en dezelfde offerte (met PDF).
    await pB.goto(`${APP}/contracten/${contractId}`);
    await pB
      .getByRole("heading", { level: 1, name: "Keuken compleet" })
      .waitFor({ timeout: 20000 });
    ok(
      (await tegelTekst(pB, "Gecontracteerd")).includes("€ 27.000") &&
        (await pB.getByText("Close-in boiler").count()) === 1,
      "B ziet hetzelfde contract, meerwerk en bedragen",
    );
    await pB.goto(`${APP}/offertes/${offerte1}`);
    const linkB = await pB.locator("iframe").getAttribute("src");
    ok((await fetch(linkB)).ok, "B kan de PDF van de offerte bekijken");

    // C ziet niets: niet in de app, niet via de opslag.
    for (const pad of [`/contracten/${contractId}`, `/offertes/${offerte1}`]) {
      await pC.goto(`${APP}${pad}`);
      await pC.waitForURL("**/welkom", { timeout: 20000 });
    }
    ok(true, "C ziet het contract en de offerte van A niet");
    const cLink = await clientC.storage
      .from("documenten")
      .createSignedUrl(bestandPad, 60);
    const cDownload = await clientC.storage
      .from("documenten")
      .download(bestandPad);
    ok(
      Boolean(cLink.error) && Boolean(cDownload.error),
      "C kan het bestand niet openen of downloaden",
    );

    // --- Fase 6: facturen, bonnen, creditnota's en betalingen -----------------
    console.log("→ Facturen, bonnen en betalingen");
    const normaal = (t) => t.replace(/\s+/g, " ");

    // Termijnfactuur via het termijnschema van het contract.
    await pA.goto(`${APP}/contracten/${contractId}`);
    await pA
      .getByRole("link", { name: "Factuur voor termijn 1 invoeren" })
      .click();
    await pA.waitForURL(/\/documenten\/nieuw\?/, { timeout: 20000 });
    ok(
      (await pA.getByRole("radio", { name: "Termijnfactuur" }).isChecked()) &&
        (await pA.getByLabel("Contract", { exact: true }).inputValue()) ===
          contractId &&
        (await pA.getByLabel("Omschrijving regel 1").inputValue()) ===
          "Termijn 1: Aanbetaling" &&
        (await pA.getByLabel("Bedrag regel 1").inputValue()) === "8.100,00",
      "termijnfactuur vanaf de termijn: soort, contract, termijn en bedrag al ingevuld",
    );
    await pA.getByLabel("Factuurnummer").fill("F-2026-001");
    await pA.getByLabel("Datum", { exact: true }).fill("10-11-2026");
    await pA.getByLabel("Uiterlijk betalen op (optioneel)").fill("24-11-2026");
    await pA.getByLabel("Totaal op het document (optioneel)").fill("8.100");
    await pA
      .getByText("Klopt met het totaal op het document")
      .waitFor({ timeout: 20000 });
    const factuurPdf = maakPdf("Factuur termijn 1");
    await pA.locator('input[type="file"]').setInputFiles({
      name: "factuur-termijn-1.pdf",
      mimeType: "application/pdf",
      buffer: factuurPdf,
    });
    await pA
      .getByText("factuur-termijn-1.pdf", { exact: true })
      .waitFor({ timeout: 30000 });
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/document-nieuw.png`,
        fullPage: true,
      });
    await pA.getByRole("button", { name: "Boeken" }).click();
    await pA.waitForURL(uuidEind("/documenten"), { timeout: 20000 });
    const termijnFactuur = idUitUrl(pA);
    const { data: tf } = await clientA
      .from("cost_documents")
      .select(
        "status, reviewed_by, booked_at, contract_id, installment_id, due_date, file_id, cost_lines (contract_id, amount_incl_cents)",
      )
      .eq("id", termijnFactuur)
      .single();
    ok(
      tf.status === "geboekt" &&
        tf.reviewed_by === ids[0] &&
        tf.booked_at &&
        tf.contract_id === contractId &&
        tf.installment_id &&
        tf.due_date === "2026-11-24" &&
        tf.file_id &&
        tf.cost_lines.length === 1 &&
        tf.cost_lines[0].contract_id === contractId &&
        tf.cost_lines[0].amount_incl_cents === 810000,
      "termijnfactuur in één keer geboekt (door A, met termijn, PDF en regel op het contract)",
    );
    ok(
      (await pA.getByText("Te laat", { exact: true }).count()) >= 1,
      "vervaldatum verstreken: de factuur staat op te laat",
    );

    // Geen dubbeltelling: de factuur valt binnen het contract.
    await openCategorie(pA, "Keuken");
    ok(
      (await tegelTekst(pA, "Prognose")).includes("€ 27.000"),
      "Keuken blijft € 27.000: de termijnfactuur telt binnen het contract, niet erbovenop",
    );
    await pA.goto(`${APP}/contracten/${contractId}`);
    ok(
      (await tegelTekst(pA, "Gefactureerd")).includes("€ 8.100") &&
        normaal(
          await pA.locator("ol li", { hasText: "Aanbetaling" }).innerText(),
        ).includes("Gefactureerd") &&
        (await pA
          .getByRole("region", { name: "Facturen" })
          .getByRole("link", { name: /Keukenstudio Noord/ })
          .count()) === 1,
      "contract: € 8.100 gefactureerd, termijn 1 gefactureerd, factuur in de lijst",
    );

    // Betalen in twee delen.
    await pA.goto(`${APP}/documenten/${termijnFactuur}`);
    const betaalForm = pA.locator("form", {
      has: pA.getByRole("button", { name: "Betaling vastleggen" }),
    });
    ok(
      (await betaalForm.getByLabel("Bedrag", { exact: true }).inputValue()) ===
        "8.100,00",
      "betaling: openstaand bedrag staat al ingevuld",
    );
    await betaalForm.getByLabel("Bedrag", { exact: true }).fill("5.000");
    await betaalForm
      .getByRole("button", { name: "Betaling vastleggen" })
      .click();
    await pA.getByText("Betaling vastgelegd.").waitFor({ timeout: 20000 });
    await betaalForm.getByLabel("Bedrag", { exact: true }).fill("3.100");
    await betaalForm
      .getByRole("button", { name: "Betaling vastleggen" })
      .click();
    await pA.getByText("Volledig betaald.").waitFor({ timeout: 20000 });
    const { data: betalingen } = await clientA
      .from("payments")
      .select("amount_cents")
      .eq("cost_document_id", termijnFactuur);
    ok(
      betalingen
        .map((b) => b.amount_cents)
        .sort((a, b) => a - b)
        .join() === "310000,500000" &&
        (await pA.getByText("Betaald", { exact: true }).count()) >= 1,
      "in twee delen betaald (€ 5.000 + € 3.100): status betaald",
    );
    const teveel = await clientA.from("payments").insert({
      project_id: projectId,
      cost_document_id: termijnFactuur,
      amount_cents: 1,
      paid_on: "2026-11-26",
    });
    ok(Boolean(teveel.error), "meer betalen dan de factuur wordt geweigerd");
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/document-detail.png`,
        fullPage: true,
      });

    // Geboekte, betaalde factuur corrigeren (in één keer, betalingen blijven).
    await pA.getByRole("link", { name: "Bewerken" }).click();
    await pA.waitForURL(/\/bewerken$/, { timeout: 20000 });
    await pA.getByLabel("Uiterlijk betalen op (optioneel)").fill("30-11-2026");
    await pA.getByRole("button", { name: "Wijzigingen opslaan" }).click();
    await pA.waitForURL(uuidEind("/documenten"), { timeout: 20000 });
    const { data: tf2 } = await clientA
      .from("cost_documents")
      .select("status, due_date, payments (amount_cents)")
      .eq("id", termijnFactuur)
      .single();
    ok(
      tf2.status === "geboekt" &&
        tf2.due_date === "2026-11-30" &&
        tf2.payments.length === 2,
      "geboekte en betaalde factuur bewerkt; blijft geboekt, betalingen blijven",
    );

    // Eén bon verdeeld over twee categorieën, met een ruimte.
    await pA.goto(`${APP}/documenten/nieuw?type=bon`);
    await pA
      .getByLabel("Leverancier", { exact: true })
      .selectOption("__nieuw__");
    await pA.getByLabel("Naam nieuwe leverancier").fill("Bouwmarkt Zuid");
    await pA.getByLabel("Totaal op het document (optioneel)").fill("190,50");
    await pA.getByLabel("Omschrijving regel 1").fill("Tegels badkamer");
    await pA
      .getByLabel("Hoort bij regel 1")
      .selectOption({ label: "Afbouw › Badkamer & toilet" });
    await pA.getByLabel("Bedrag regel 1").fill("150,50");
    await pA.getByRole("button", { name: "Ruimtes regel 1" }).click();
    await pA.getByLabel("Badkamer", { exact: true }).check();
    await pA.getByRole("button", { name: "Regel toevoegen" }).click();
    await pA.getByLabel("Omschrijving regel 2").fill("Verf woonkamer");
    await pA
      .getByLabel("Hoort bij regel 2")
      .selectOption({ label: "Afbouw › Wanden & plafonds" });
    await pA.getByLabel("Bedrag regel 2").fill("40");
    await pA
      .getByText("Klopt met het totaal op het document")
      .waitFor({ timeout: 20000 });
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/bon-nieuw.png`,
        fullPage: true,
      });
    await pA.getByRole("button", { name: "Boeken" }).click();
    await pA.waitForURL(uuidEind("/documenten"), { timeout: 20000 });
    const bonId = idUitUrl(pA);
    const { data: bon } = await clientA
      .from("cost_lines")
      .select(
        "description, amount_incl_cents, categories (name), room_allocations (share_bp, rooms (name))",
      )
      .eq("cost_document_id", bonId)
      .order("sort_order");
    ok(
      bon.length === 2 &&
        bon[0].categories?.name === "Badkamer & toilet" &&
        bon[0].amount_incl_cents === 15050 &&
        bon[0].room_allocations.length === 1 &&
        bon[0].room_allocations[0].rooms?.name === "Badkamer" &&
        bon[1].categories?.name === "Wanden & plafonds" &&
        bon[1].amount_incl_cents === 4000,
      "één bon over twee categorieën verdeeld (met ruimte Badkamer), één keer bewaard",
    );
    await openCategorie(pA, "Badkamer & toilet");
    ok(
      normaal(
        await pA.getByRole("region", { name: "Losse kosten" }).innerText(),
      ).includes("€ 150,50"),
      "categorie Badkamer & toilet toont het deel van de bon (€ 150,50)",
    );

    // Totaal klopt niet: niet boeken, wel als concept; daarna verwijderen.
    await pA.goto(`${APP}/documenten/nieuw`);
    await pA
      .getByLabel("Leverancier", { exact: true })
      .selectOption({ label: "Bouwmarkt Zuid" });
    await pA.getByLabel("Factuurnummer").fill("BZ-77");
    await pA.getByLabel("Totaal op het document (optioneel)").fill("100");
    await pA.getByLabel("Omschrijving regel 1").fill("Kitten en lijm");
    await pA
      .getByLabel("Hoort bij regel 1")
      .selectOption({ label: "Afbouw › Badkamer & toilet" });
    await pA.getByLabel("Bedrag regel 1").fill("90");
    await pA
      .getByText(/Nog .* te verdelen tot het totaal op het document/)
      .waitFor({ timeout: 20000 });
    await pA.getByRole("button", { name: "Boeken" }).click();
    const verschil = pA.getByText(/De regels tellen op tot/);
    await verschil.waitFor({ timeout: 20000 });
    ok(
      normaal(await verschil.innerText()).includes(
        "€ 90,00, maar op het document staat € 100,00",
      ),
      "boeken geweigerd als de regels niet optellen tot het totaal op het document",
    );
    await pA.getByRole("button", { name: "Opslaan als concept" }).click();
    await pA.waitForURL(uuidEind("/documenten"), { timeout: 20000 });
    const conceptId = idUitUrl(pA);
    await pA.goto(`${APP}/te-controleren`);
    ok(
      (await pA.getByRole("link", { name: /Bouwmarkt Zuid/ }).count()) === 1 &&
        normaal(
          await pA
            .getByRole("link", { name: /Te controleren/ })
            .first()
            .innerText(),
        ).includes("1"),
      "concept staat bij Te controleren (met teller in het menu) en telt niet mee",
    );
    await pA.goto(`${APP}/documenten/${conceptId}`);
    await pA.getByRole("button", { name: "Boeken" }).click();
    await pA
      .getByText("De som van de regels wijkt af van het totaal op het document")
      .waitFor({ timeout: 20000 });
    ok(true, "ook de database weigert boeken als het totaal niet klopt");
    await pA.getByLabel(/Ja, verwijder dit document/).check();
    await pA.getByRole("button", { name: "Document verwijderen" }).click();
    await pA.waitForURL(`${APP}/documenten`, { timeout: 20000 });
    ok(
      (
        await clientA
          .from("cost_documents")
          .select("id", { count: "exact", head: true })
          .eq("id", conceptId)
      ).count === 0,
      "concept verwijderd",
    );

    // Dubbel bestand en dubbel factuurnummer worden herkend.
    await pA.goto(`${APP}/documenten/nieuw`);
    await pA
      .getByLabel("Leverancier", { exact: true })
      .selectOption({ label: "Keukenstudio Noord" });
    await pA.getByLabel("Factuurnummer").fill("F-2026-001");
    await pA.getByLabel("Omschrijving regel 1").fill("Nogmaals");
    await pA
      .getByLabel("Hoort bij regel 1")
      .selectOption({ label: "Afbouw › Keuken" });
    await pA.getByLabel("Bedrag regel 1").fill("100");
    await pA.locator('input[type="file"]').setInputFiles({
      name: "kopie-factuur.pdf",
      mimeType: "application/pdf",
      buffer: factuurPdf,
    });
    await pA
      .getByText("Dit bestand stond al in je project", { exact: false })
      .waitFor({ timeout: 30000 });
    await pA.getByRole("button", { name: "Boeken" }).click();
    await pA
      .getByText(/Dit bestand is al ingevoerd: termijnfactuur F-2026-001/)
      .waitFor({ timeout: 20000 });
    ok(
      (await pA
        .getByRole("link", { name: "Bekijk het bestaande document" })
        .getAttribute("href")) === `/documenten/${termijnFactuur}`,
      "zelfde PDF nogmaals: geweigerd, met link naar het bestaande document",
    );
    await pA.getByRole("button", { name: "Bestand loskoppelen" }).click();
    await pA.getByRole("button", { name: "Boeken" }).click();
    await pA
      .getByText(
        "Er staat al een document met dit nummer van deze leverancier",
        {
          exact: false,
        },
      )
      .waitFor({ timeout: 20000 });
    ok(true, "zelfde factuurnummer bij dezelfde leverancier: geweigerd");

    // Creditnota op een contractregel; terugbetaling ontvangen.
    await pA.goto(`${APP}/documenten/nieuw?type=creditnota`);
    await pA
      .getByLabel("Leverancier", { exact: true })
      .selectOption({ label: "Keukenstudio Noord" });
    await pA.getByLabel("Factuurnummer").fill("C-001");
    await pA.getByLabel("Contract (optioneel)").selectOption(contractId);
    await pA.getByLabel("Omschrijving regel 1").fill("Korting werkblad");
    await pA
      .getByLabel("Hoort bij regel 1")
      .selectOption({ label: "Keukenblok met werkblad (Afbouw › Keuken)" });
    await pA.getByLabel("Bedrag regel 1").fill("350");
    await pA.getByRole("button", { name: "Boeken" }).click();
    await pA.waitForURL(uuidEind("/documenten"), { timeout: 20000 });
    const creditnota = idUitUrl(pA);
    const terugForm = pA.locator("form", {
      has: pA.getByRole("button", { name: "Terugbetaling vastleggen" }),
    });
    await terugForm
      .getByRole("button", { name: "Terugbetaling vastleggen" })
      .click();
    // Daarna staat er niets meer open: het formulier verdwijnt.
    await pA.getByText("Volledig betaald.").waitFor({ timeout: 20000 });
    const { data: cn } = await clientA
      .from("cost_documents")
      .select("cost_lines (amount_incl_cents), payments (amount_cents)")
      .eq("id", creditnota)
      .single();
    ok(
      cn.cost_lines[0].amount_incl_cents === -35000 &&
        cn.payments[0].amount_cents === -35000,
      "creditnota en terugbetaling als min-bedrag opgeslagen (−€ 350)",
    );
    await pA.goto(`${APP}/contracten/${contractId}`);
    ok(
      (await tegelTekst(pA, "Gefactureerd")).includes("€ 7.750") &&
        (await tegelTekst(pA, "Betaald")).includes("€ 7.750"),
      "contract: gefactureerd en betaald € 8.100 − € 350 = € 7.750",
    );
    await openCategorie(pA, "Keuken");
    ok(
      (await tegelTekst(pA, "Prognose")).includes("€ 27.000"),
      "Keuken blijft € 27.000 (contract is nog niet afgerond)",
    );

    // Overzicht.
    await pA.goto(`${APP}/documenten`);
    const samenvatting = normaal(
      await pA.getByRole("region", { name: "Samenvatting" }).innerText(),
    );
    ok(
      samenvatting.includes("Gefactureerd € 7.941") &&
        samenvatting.includes("Betaald € 7.750") &&
        samenvatting.includes("Nog te betalen € 191"),
      "overzicht: gefactureerd € 7.940,50, betaald € 7.750, nog te betalen € 190,50",
    );
    await pA.goto(`${APP}/documenten?status=open`);
    ok(
      (await pA.getByRole("link", { name: /Bouwmarkt Zuid/ }).count()) === 1 &&
        (await pA.getByRole("link", { name: /Keukenstudio Noord/ }).count()) ===
          0,
      "filter 'nog te betalen' toont alleen de bon",
    );
    if (SCREENSHOTS) {
      await pA.goto(`${APP}/documenten`);
      await pA.screenshot({
        path: `${SCREENSHOTS}/documenten.png`,
        fullPage: true,
      });
    }

    // B ziet dezelfde documenten; C niets.
    await pB.goto(`${APP}/documenten/${termijnFactuur}`);
    await pB
      .getByRole("heading", { level: 1, name: "Termijnfactuur F-2026-001" })
      .waitFor({ timeout: 20000 });
    ok(
      (await fetch(await pB.locator("iframe").getAttribute("src"))).ok,
      "B ziet dezelfde factuur, inclusief PDF",
    );
    await pC.goto(`${APP}/documenten/${termijnFactuur}`);
    await pC.waitForURL("**/welkom", { timeout: 20000 });
    ok(true, "C ziet de factuur van A niet");

    // --- Fase 7: dashboard en rapportages -------------------------------------
    console.log("→ Dashboard en rapportages");
    await pA.goto(`${APP}/dashboard`);
    const kern = normaal(
      await pA.getByRole("region", { name: "Kerncijfers" }).innerText(),
    );
    ok(
      (await pA.getByText("Demo-gegevens").count()) === 0 &&
        kern.includes("Totaal budget € 25.000") &&
        kern.includes("Betaald € 7.750") &&
        kern.includes("Prognose eindkosten"),
      "dashboard toont de echte cijfers (budget € 25.000, betaald € 7.750), zonder demo",
    );
    ok(
      normaal(
        await pA
          .getByRole("region", { name: "Budget en prognose per categorie" })
          .innerText(),
      ).includes("Keuken") &&
        normaal(
          await pA.getByRole("region", { name: "Te betalen" }).innerText(),
        ).includes("Bouwmarkt Zuid") &&
        normaal(
          await pA
            .getByRole("region", { name: "Recente activiteit" })
            .innerText(),
        ).includes("geboekt") &&
        (await pA.getByRole("region", { name: "Aan de slag" }).count()) === 0,
      "dashboard: categorieën, te betalen (de bon) en recente activiteit; startstappen verdwenen",
    );
    if (SCREENSHOTS) {
      await pA.screenshot({
        path: `${SCREENSHOTS}/dashboard.png`,
        fullPage: true,
      });
      await pA.setViewportSize({ width: 390, height: 844 });
      await pA.screenshot({
        path: `${SCREENSHOTS}/dashboard-mobiel.png`,
        fullPage: true,
      });
      await pA.setViewportSize({ width: 1440, height: 900 });
    }
    await pA.goto(`${APP}/dashboard?demo=1`);
    await pA.getByText("Demo-gegevens.").waitFor({ timeout: 20000 });
    ok(true, "voorbeeld met verzonnen cijfers blijft te bekijken (?demo=1)");

    // Rapportages.
    await pA.goto(`${APP}/rapportages`);
    const keukenRij = normaal(
      await pA.getByRole("row", { name: /^Keuken / }).innerText(),
    );
    ok(
      keukenRij.includes("€ 25.000,00") && keukenRij.includes("€ 27.000,00"),
      "rapport per categorie: Keuken budget € 25.000, prognose € 27.000",
    );
    await pA.goto(`${APP}/rapportages?rapport=ruimte`);
    ok(
      normaal(
        await pA.getByRole("row", { name: /^Keuken / }).innerText(),
      ).includes("€ 21.350,00"),
      "rapport per ruimte: Keuken € 21.350 gecontracteerd (de toegewezen contractregel)",
    );
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/rapport-ruimte.png`,
        fullPage: true,
      });
    await pA.goto(`${APP}/rapportages?rapport=leverancier`);
    const kRij = normaal(
      await pA.getByRole("row", { name: /^Keukenstudio Noord/ }).innerText(),
    );
    ok(
      kRij.includes("€ 27.000,00") &&
        kRij.split("€ 7.750,00").length === 3 &&
        kRij.includes("€ 0,00"),
      "rapport per leverancier: Keukenstudio Noord € 27.000 gecontracteerd, € 7.750 gefactureerd en betaald",
    );

    // Export: CSV voor Nederlandse Excel en een Excel-werkmap.
    const csv = await pA.request.get(
      `${APP}/rapportages/export?rapport=categorie&formaat=csv`,
    );
    const csvTekst = await csv.text();
    ok(
      csv.ok() &&
        csv.headers()["content-type"].startsWith("text/csv") &&
        csv.headers()["content-disposition"].includes("attachment") &&
        csvTekst.startsWith("﻿") &&
        csvTekst.includes(
          "Afbouw;Keuken;25000,00;27000,00;7750,00;7750,00;0,00;27000,00;2000,00;Open",
        ),
      "CSV-export: puntkomma's, decimale komma, Keuken-regel exact",
    );
    const xlsx = await pA.request.get(
      `${APP}/rapportages/export?rapport=alles&formaat=xlsx`,
    );
    const ExcelJS = require("exceljs");
    const werkmap = new ExcelJS.Workbook();
    await werkmap.xlsx.load(await xlsx.body());
    let keukenXlsx;
    werkmap.getWorksheet("Categorieën").eachRow((r) => {
      if (r.getCell(2).value === "Keuken") keukenXlsx = r;
    });
    ok(
      xlsx.ok() &&
        werkmap.worksheets.map((w) => w.name).join() ===
          "Categorieën,Ruimtes,Leveranciers,Betalingen,Documenten" &&
        keukenXlsx?.getCell(3).value === 25000 &&
        keukenXlsx?.getCell(8).value === 27000,
      "Excel-export: vijf tabbladen, bedragen als echte getallen (Keuken 25.000 / 27.000)",
    );

    // Afdrukken / PDF: licht en zonder menu's.
    await pA.goto(`${APP}/rapportages`);
    await pA.emulateMedia({ media: "print" });
    ok(
      !(await pA.locator("aside").isVisible()) &&
        (await pA.getByRole("button", { name: "PDF" }).isHidden()),
      "afdrukweergave zonder menu en knoppen",
    );
    if (SCREENSHOTS)
      await pA.pdf({
        path: `${SCREENSHOTS}/rapport-categorie.pdf`,
        format: "A4",
        printBackground: true,
      });
    await pA.emulateMedia({ media: "screen" });

    // Toegang: C en niet-ingelogd krijgen geen export.
    const exportC = await pC.request.get(
      `${APP}/rapportages/export?rapport=categorie&formaat=csv`,
    );
    const exportAnon = await fetch(
      `${APP}/rapportages/export?rapport=categorie&formaat=csv`,
    );
    ok(
      !(exportC.headers()["content-type"] ?? "").includes("csv") &&
        !(await exportC.text()).includes("Keuken") &&
        exportAnon.url.includes("/inloggen") &&
        !(exportAnon.headers.get("content-type") ?? "").includes("csv"),
      "C en niet-ingelogd krijgen geen export (doorgestuurd)",
    );
    await pB.goto(`${APP}/dashboard`);
    ok(
      normaal(
        await pB.getByRole("region", { name: "Kerncijfers" }).innerText(),
      ).includes("Betaald € 7.750"),
      "B ziet hetzelfde dashboard",
    );

    // B ziet hetzelfde budget; C helemaal niets.
    await pB.goto(`${APP}/budget`);
    await pB.getByText("€ 25.000").first().waitFor({ timeout: 20000 });
    await openCategorie(pB, "Keuken");
    ok(
      (await pB.getByText("Keukenkasten", { exact: true }).count()) === 1,
      "B ziet hetzelfde budget en dezelfde budgetregels",
    );
    await pC.goto(`${APP}/budget/${keukenId}`);
    await pC.waitForURL("**/welkom", { timeout: 20000 });
    ok(true, "C (geen toegang) ziet het budget van A niet");

    // --- Gegevens via de API (zelfde rechten als de app) ---------------------
    console.log("→ Gegevens vergelijken via de API");
    const r1 = await clientA
      .from("categories")
      .insert({ project_id: projectId, name: "API-categorie" });
    const r2 = await clientB
      .from("suppliers")
      .insert({ project_id: projectId, name: "Leverancier van B" });
    ok(!r1.error && !r2.error, "A en B kunnen allebei gegevens toevoegen");

    const tabellen = [
      "projects",
      "project_members",
      "categories",
      "budget_lines",
      "rooms",
      "suppliers",
      "profiles",
      "files",
      "quotes",
      "quote_lines",
      "contracts",
      "contract_lines",
      "contract_changes",
      "contract_installments",
      "room_allocations",
      "cost_documents",
      "cost_lines",
      "payments",
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
      "A en B zien exact dezelfde gegevens (project, leden, budget, ruimtes, leveranciers, bestanden, offertes, contracten, meerwerk, termijnen, facturen, betalingen)",
    );
    ok(
      zichtA.categories.some((c) => c.name === "API-categorie") &&
        zichtA.suppliers.length === 5 &&
        zichtA.budget_lines.length === 2 &&
        zichtA.rooms.length === 12 &&
        zichtA.quotes.length === 1 &&
        zichtA.contracts.length === 1 &&
        zichtA.contract_lines.length === 2 &&
        zichtA.contract_changes.length === 2 &&
        zichtA.contract_installments.length === 2 &&
        zichtA.files.length === 2 &&
        zichtA.cost_documents.length === 3 &&
        zichtA.cost_lines.length === 4 &&
        zichtA.payments.length === 3,
      "alle toevoegingen zichtbaar (budget, ruimtes, offertes, contracten, facturen, betalingen)",
    );

    const zichtC = await zicht(clientC);
    ok(
      zichtC.projects.length === 0 &&
        zichtC.project_members.length === 0 &&
        zichtC.categories.length === 0 &&
        zichtC.budget_lines.length === 0 &&
        zichtC.rooms.length === 0 &&
        zichtC.suppliers.length === 0 &&
        zichtC.files.length === 0 &&
        zichtC.quotes.length === 0 &&
        zichtC.quote_lines.length === 0 &&
        zichtC.contracts.length === 0 &&
        zichtC.contract_lines.length === 0 &&
        zichtC.contract_changes.length === 0 &&
        zichtC.contract_installments.length === 0 &&
        zichtC.room_allocations.length === 0 &&
        zichtC.cost_documents.length === 0 &&
        zichtC.cost_lines.length === 0 &&
        zichtC.payments.length === 0 &&
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

    // --- AI-documentherkenning (fase 8) --------------------------------------
    console.log("→ AI-documentherkenning");
    await pA.goto(`${APP}/te-controleren/nieuw?bron=camera`);
    await pA
      .getByRole("heading", { name: "Bon fotograferen" })
      .waitFor({ timeout: 20000 });
    const aiAan =
      (await pA.getByText("De AI-herkenning is nog niet ingesteld").count()) ===
      0;
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/ai-uploaden.png`,
        fullPage: true,
      });
    console.log(
      aiAan
        ? "  (AI is ingesteld: ook een echte herkenning)"
        : "  (AI niet ingesteld: zonder-sleutel-pad en vast testvoorstel)",
    );
    const camera = pA.locator('input[type="file"]');
    ok(
      (await camera.getAttribute("capture")) === "environment" &&
        !(await camera.getAttribute("accept")).includes("heic"),
      "bon fotograferen opent op een telefoon de camera; alleen typen die de AI kan lezen",
    );
    const grotePng = maakPng(3000, 2000);
    await camera.setInputFiles({
      name: "bon-groot.png",
      mimeType: "image/png",
      buffer: grotePng,
    });
    await pA
      .getByText("bon-groot.jpg", { exact: true })
      .waitFor({ timeout: 60000 });
    const { data: foto } = await clientA
      .from("files")
      .select("id, mime_type, size_bytes")
      .eq("project_id", projectId)
      .eq("original_name", "bon-groot.jpg")
      .single();
    ok(
      foto.mime_type === "image/jpeg" &&
        foto.size_bytes < 1024 * 1024 &&
        grotePng.length > 5 * 1024 * 1024,
      `grote foto (${(grotePng.length / 1048576).toFixed(1)} MB, 3000 × 2000) in de browser verkleind tot JPG van ${Math.round(foto.size_bytes / 1024)} kB`,
    );
    if (!aiAan) {
      await pA.getByRole("button", { name: "Verder: zelf invoeren" }).click();
      await pA.waitForURL(/\/documenten\/nieuw\?bestand=/, { timeout: 20000 });
      ok(
        new URL(pA.url()).searchParams.get("bestand") === foto.id &&
          (await pA.getByRole("radio", { name: "Bon" }).isChecked()) &&
          (await pA.getByText("bon-groot.jpg", { exact: true }).count()) === 1,
        "zonder AI-sleutel: door naar zelf invoeren, met de foto al gekoppeld en soort bon",
      );
    }

    // Vast testvoorstel, precies zoals de herkenning het opslaat, zodat het
    // controleren en boeken ook zonder AI-sleutel getest wordt.
    const testBestand = async (naam) => {
      await pA.goto(`${APP}/documenten/nieuw`);
      await pA.locator('input[type="file"]').setInputFiles({
        name: naam,
        mimeType: "application/pdf",
        buffer: maakPdf(`Testdocument ${naam} ${sfx}`),
      });
      await pA.getByText(naam, { exact: true }).waitFor({ timeout: 30000 });
      return pA.locator('input[name="bestandId"]').inputValue();
    };
    const sqlTekst = (w) => `'${String(w).replaceAll("'", "''")}'`;
    const { data: badkamerCat } = await clientA
      .from("categories")
      .select("id")
      .eq("project_id", projectId)
      .eq("name", "Badkamer & toilet")
      .single();
    const w = (waarde, zekerheid = 0.97, bron = null) => ({
      waarde,
      zekerheid,
      bron,
    });
    const testResultaat = {
      is_document: true,
      soort: w("factuur"),
      leverancier: w("Tegelhandel Fixture B.V."),
      leverancier_kvk: w("87654321"),
      leverancier_iban: w("NL91 ABNA 0417 1643 00"),
      leverancier_btw_nummer: w("NL123456789B01"),
      documentnummer: w("TF-2026-118"),
      documentdatum: w("2026-11-20", 0.72, "20-11-2026"),
      vervaldatum: w(null, 0.2),
      betaaltermijn_dagen: w(14, 0.9, "Betaling binnen 14 dagen"),
      totaal_incl: w(302.5, 0.96, "Totaal EUR 302,50"),
      totaal_btw: w(52.5),
      btw_per_tarief: [{ tarief: 21, grondslag: 250, btw: 52.5 }],
      verwijzing: w(null, 0),
      contract_id: w(null, 0),
      termijn_id: w(null, 0),
      regels: [
        {
          omschrijving: "Wandtegels 30x60",
          bedrag_incl: 242,
          bedrag_excl: 200,
          btw_tarief: 21,
          categorie_id: badkamerCat.id,
          ruimte_id: null,
          contract_regel_id: null,
          zekerheid: 0.95,
          bron: "Wandtegels 30x60 242,00",
        },
        {
          omschrijving: "Tegellijm",
          bedrag_incl: 60.5,
          bedrag_excl: 50,
          btw_tarief: 21,
          categorie_id: null,
          ruimte_id: null,
          contract_regel_id: null,
          zekerheid: 0.9,
          bron: "Tegellijm 60,50",
        },
      ],
      opmerkingen: ["De datum is deels handgeschreven."],
    };
    const testPunten = [
      {
        soort: "ontbreekt",
        veld: "regel-2",
        tekst: "Regel 2: kies waar deze kosten bij horen.",
      },
      {
        soort: "onzeker",
        veld: "documentdatum",
        tekst: "Datum: 72% zeker; controleer dit.",
      },
    ];
    const bestand1 = await testBestand("tegelhandel-factuur.pdf");
    const [voorstel1] = await sql(`
      insert into public.document_extractions
        (project_id, file_id, status, model, result, issues)
      values ('${projectId}', '${bestand1}', 'te_controleren', 'e2e-testvoorstel',
              ${sqlTekst(JSON.stringify(testResultaat))}::jsonb,
              ${sqlTekst(JSON.stringify(testPunten))}::jsonb)
      returning id`);

    await pA.goto(`${APP}/te-controleren`);
    if (SCREENSHOTS)
      await pA.screenshot({
        path: `${SCREENSHOTS}/ai-lijst.png`,
        fullPage: true,
      });
    const voorstelLink = pA.getByRole("link", {
      name: /Tegelhandel Fixture B\.V\./,
    });
    ok(
      (await voorstelLink.count()) === 1 &&
        normaal(await voorstelLink.innerText()).includes("€ 302,50") &&
        normaal(await voorstelLink.innerText()).includes("2 punten"),
      "AI-voorstel staat bij Te controleren, met bedrag en aantal punten",
    );
    await pA.goto(`${APP}/dashboard`);
    ok(
      (await pA
        .getByRole("region", { name: "Te controleren" })
        .getByText("Tegelhandel Fixture B.V.")
        .count()) === 1,
      "dashboard toont het voorstel bij Te controleren",
    );

    await pA.goto(`${APP}/te-controleren/${voorstel1.id}`);
    await pA
      .getByRole("heading", { name: "Voorstel controleren" })
      .waitFor({ timeout: 20000 });
    ok(
      (await pA.locator("iframe").count()) === 1 &&
        (await pA.getByText("2 punten om te controleren").count()) === 1 &&
        (await pA.getByText("De datum is deels handgeschreven.").count()) ===
          1 &&
        (await pA.getByText("Datum: 72% zeker; controleer dit.").count()) === 2,
      "controlescherm: origineel ernaast, aandachtspunten (ook bij het veld) en opmerkingen van de AI",
    );
    ok(
      (await pA.getByLabel("Factuurnummer").inputValue()) === "TF-2026-118" &&
        (await pA.getByLabel("Datum", { exact: true }).inputValue()) ===
          "20-11-2026" &&
        (await pA
          .getByLabel("Uiterlijk betalen op (optioneel)")
          .inputValue()) === "04-12-2026" &&
        (await pA
          .getByLabel("Totaal op het document (optioneel)")
          .inputValue()) === "302,50" &&
        (await pA.getByLabel("Leverancier", { exact: true }).inputValue()) ===
          "__nieuw__" &&
        (await pA.getByLabel("Naam nieuwe leverancier").inputValue()) ===
          "Tegelhandel Fixture B.V." &&
        (await pA.getByLabel("Hoort bij regel 1").inputValue()) ===
          `k:${badkamerCat.id}` &&
        (await pA.getByLabel("Bedrag regel 1").inputValue()) === "242,00" &&
        (await pA.getByLabel("Bedrag regel 2").inputValue()) === "60,50" &&
        (await pA.locator('input[type="file"]').count()) === 0,
      "formulier vooringevuld: nummer, datum, vervaldatum (datum + 14 dagen), totaal, nieuwe leverancier en regels; het bestand ligt vast",
    );
    if (SCREENSHOTS) {
      await pA.screenshot({
        path: `${SCREENSHOTS}/ai-controleren.png`,
        fullPage: true,
      });
      await pA.setViewportSize({ width: 390, height: 844 });
      await pA.screenshot({
        path: `${SCREENSHOTS}/ai-controleren-mobiel.png`,
        fullPage: true,
      });
      await pA.setViewportSize({ width: 1440, height: 900 });
    }
    await pA.getByRole("button", { name: "Boeken" }).click();
    await pA
      .getByText("Kies bij regel 2 waar de kosten bij horen")
      .waitFor({ timeout: 20000 });
    ok(true, "niet geboekt zolang een regel nergens bij hoort");
    await pA
      .getByLabel("Hoort bij regel 2")
      .selectOption({ label: "Afbouw › Badkamer & toilet" });
    await pA.getByRole("button", { name: "Boeken" }).click();
    await pA.waitForURL(uuidEind("/documenten"), { timeout: 20000 });
    const aiDocument = idUitUrl(pA);
    const { data: aiDoc } = await clientA
      .from("cost_documents")
      .select(
        "status, source, document_number, document_date, due_date, stated_total_incl_cents, file_id, reviewed_by, supplier_id, cost_lines (amount_incl_cents)",
      )
      .eq("id", aiDocument)
      .single();
    ok(
      aiDoc.status === "geboekt" &&
        aiDoc.source === "ai" &&
        aiDoc.document_number === "TF-2026-118" &&
        aiDoc.document_date === "2026-11-20" &&
        aiDoc.due_date === "2026-12-04" &&
        aiDoc.stated_total_incl_cents === 30250 &&
        aiDoc.file_id === bestand1 &&
        aiDoc.reviewed_by === ids[0] &&
        aiDoc.cost_lines.length === 2,
      "na bevestiging geboekt als document (bron AI, gecontroleerd door A), het bestand één keer bewaard",
    );
    const { data: nieuweLev } = await clientA
      .from("suppliers")
      .select("name, kvk_number, iban, vat_number")
      .eq("id", aiDoc.supplier_id)
      .single();
    ok(
      nieuweLev.name === "Tegelhandel Fixture B.V." &&
        nieuweLev.kvk_number === "87654321" &&
        nieuweLev.iban === "NL91ABNA0417164300" &&
        nieuweLev.vat_number === "NL123456789B01",
      "nieuwe leverancier aangemaakt met KvK, IBAN en BTW-nummer van het document",
    );
    const { data: verwerkt } = await clientB
      .from("document_extractions")
      .select("status, cost_document_id, reviewed_by")
      .eq("id", voorstel1.id)
      .single();
    ok(
      verwerkt.status === "verwerkt" &&
        verwerkt.cost_document_id === aiDocument &&
        verwerkt.reviewed_by === ids[0],
      "voorstel verwerkt en gekoppeld aan het document (ook zo te zien voor B)",
    );
    await pA.goto(`${APP}/te-controleren/${voorstel1.id}`);
    await pA.waitForURL(`**/documenten/${aiDocument}`, { timeout: 20000 });
    await pA.goto(`${APP}/te-controleren`);
    ok(
      (await pA.getByRole("link", { name: /Tegelhandel Fixture/ }).count()) ===
        0,
      "verwerkt voorstel opent het document en staat niet meer bij Te controleren",
    );

    // Mislukt voorstel: zelf invoeren en boeken; net als bij zelf invoeren
    // zijn nummer, totaal en leverancier niet verplicht.
    const bestand2 = await testBestand("onleesbaar.pdf");
    const [voorstel2] = await sql(`
      insert into public.document_extractions
        (project_id, file_id, status, model, error)
      values ('${projectId}', '${bestand2}', 'mislukt', 'e2e-testvoorstel',
              'Het uitlezen duurde te lang. Probeer het opnieuw.')
      returning id`);
    await pA.goto(`${APP}/te-controleren/${voorstel2.id}`);
    await pA
      .getByText("Het uitlezen duurde te lang. Probeer het opnieuw.")
      .waitFor({ timeout: 20000 });
    ok(
      (await pA.getByRole("heading", { name: "Zelf invoeren" }).count()) ===
        1 &&
        (await pA.getByRole("button", { name: "Opnieuw uitlezen" }).count()) ===
          (aiAan ? 1 : 0),
      "mislukt voorstel: melding en zelf invoeren (opnieuw uitlezen alleen als de AI is ingesteld)",
    );
    await pA.getByLabel("Omschrijving regel 1").fill("Kitten en lijm");
    await pA
      .getByLabel("Hoort bij regel 1")
      .selectOption({ label: "Afbouw › Badkamer & toilet" });
    await pA.getByLabel("Bedrag regel 1").fill("24,95");
    await pA.getByRole("button", { name: "Boeken" }).click();
    await pA.waitForURL(uuidEind("/documenten"), { timeout: 20000 });
    const zelfIngevoerd = idUitUrl(pA);
    const { data: zelfDoc } = await clientA
      .from("cost_documents")
      .select(
        "status, source, document_number, stated_total_incl_cents, supplier_id, file_id",
      )
      .eq("id", zelfIngevoerd)
      .single();
    const { data: voorstel2Na } = await clientA
      .from("document_extractions")
      .select("status, cost_document_id")
      .eq("id", voorstel2.id)
      .single();
    ok(
      zelfDoc.status === "geboekt" &&
        zelfDoc.source === "ai" &&
        zelfDoc.document_number === null &&
        zelfDoc.stated_total_incl_cents === null &&
        zelfDoc.supplier_id === null &&
        zelfDoc.file_id === bestand2 &&
        voorstel2Na.status === "verwerkt" &&
        voorstel2Na.cost_document_id === zelfIngevoerd,
      "vanuit een mislukt voorstel zelf ingevoerd en geboekt, zonder nummer, totaal of leverancier (zelfde regels als zelf invoeren)",
    );

    // Voorstel weggooien (bijv. verkeerde foto): het bestand gaat mee.
    const bestand3 = await testBestand("verkeerde-foto.pdf");
    const { data: bestand3Info } = await clientA
      .from("files")
      .select("storage_path")
      .eq("id", bestand3)
      .single();
    const [voorstel3] = await sql(`
      insert into public.document_extractions
        (project_id, file_id, status, model, error)
      values ('${projectId}', '${bestand3}', 'mislukt', 'e2e-testvoorstel',
              'Dit lijkt geen factuur of bon.')
      returning id`);
    await pA.goto(`${APP}/te-controleren/${voorstel3.id}`);
    await pA.getByLabel("Ja, verwijder dit voorstel.").check();
    await pA.getByRole("button", { name: "Voorstel verwijderen" }).click();
    await pA.waitForURL((u) => u.pathname === "/te-controleren", {
      timeout: 20000,
    });
    const { data: voorstel3Na } = await clientA
      .from("document_extractions")
      .select("id")
      .eq("id", voorstel3.id);
    const { data: bestand3Na } = await clientA
      .from("files")
      .select("id")
      .eq("id", bestand3);
    const [opslag3] = await sql(
      `select count(*) as n from storage.objects where bucket_id = 'documenten' and name = ${sqlTekst(bestand3Info.storage_path)}`,
    );
    ok(
      voorstel3Na.length === 0 &&
        bestand3Na.length === 0 &&
        Number(opslag3.n) === 0,
      "voorstel verwijderd, met het bestand uit de opslag (hoorde nergens anders bij)",
    );

    // Toegang: B ziet dezelfde voorstellen, C niets.
    const aVoorstellen = await clientA
      .from("document_extractions")
      .select("id, status, result, issues")
      .order("created_at");
    const bVoorstellen = await clientB
      .from("document_extractions")
      .select("id, status, result, issues")
      .order("created_at");
    const cVoorstellen = await clientC
      .from("document_extractions")
      .select("id");
    const cWijzigt = await clientC
      .from("document_extractions")
      .update({ status: "afgewezen" })
      .eq("project_id", projectId)
      .select();
    ok(
      aVoorstellen.data.length >= 1 &&
        JSON.stringify(aVoorstellen.data) ===
          JSON.stringify(bVoorstellen.data) &&
        cVoorstellen.data.length === 0 &&
        !cWijzigt.error &&
        cWijzigt.data.length === 0,
      "A en B zien dezelfde AI-voorstellen; C ziet en wijzigt er geen",
    );
    await pC.goto(`${APP}/te-controleren/${voorstel1.id}`);
    await pC.waitForURL("**/welkom", { timeout: 20000 });
    ok(true, "C (geen toegang) opent het controlescherm niet");

    // Met AI-sleutel: een echte herkenning van een testfactuur (niet boeken).
    if (aiAan) {
      await pA.goto(`${APP}/te-controleren/nieuw`);
      await pA.locator('input[type="file"]').setInputFiles({
        name: "testfactuur-ai.pdf",
        mimeType: "application/pdf",
        buffer: maakPdf(TESTFACTUUR),
      });
      await pA
        .getByText("testfactuur-ai.pdf", { exact: true })
        .waitFor({ timeout: 30000 });
      const start = Date.now();
      await pA.getByRole("button", { name: "Uitlezen" }).click();
      await pA.waitForURL(uuidEind("/te-controleren"), { timeout: 90000 });
      const duur = Math.round((Date.now() - start) / 1000);
      await pA
        .getByRole("heading", { name: "Voorstel controleren" })
        .waitFor({ timeout: 20000 });
      if ((await pA.getByRole("heading", { name: "Gegevens" }).count()) === 0) {
        const melding = await pA.getByRole("alert").first().innerText();
        const details = pA.locator("details", {
          hasText: "Technische details",
        });
        const detail = (await details.count())
          ? normaal(await details.first().textContent())
          : "";
        ok(
          false,
          `echte herkenning mislukt na ${duur} s: ${melding}${detail ? ` (${detail})` : ""}`,
        );
      }
      if (SCREENSHOTS)
        await pA.screenshot({
          path: `${SCREENSHOTS}/ai-echt.png`,
          fullPage: true,
        });
      ok(
        (await pA.getByLabel("Factuurnummer").inputValue()) ===
          "TM-2026-0042" &&
          (await pA.getByLabel("Datum", { exact: true }).inputValue()) ===
            "12-11-2026" &&
          (await pA
            .getByLabel("Uiterlijk betalen op (optioneel)")
            .inputValue()) === "26-11-2026" &&
          (await pA
            .getByLabel("Totaal op het document (optioneel)")
            .inputValue()) === "1.331,00",
        `echte herkenning (${duur} s): nummer, datum, vervaldatum en totaal goed gelezen`,
      );
      ok(
        (await pA.getByLabel("Bedrag regel 1").inputValue()) === "1.210,00" &&
          (await pA.getByLabel("Bedrag regel 2").inputValue()) === "121,00" &&
          (
            await pA.getByLabel("Naam nieuwe leverancier").inputValue()
          ).includes("Testmans"),
        "echte herkenning: twee regels met de juiste bedragen en de leverancier",
      );
      await pA.getByLabel("Ja, verwijder dit voorstel.").check();
      await pA.getByRole("button", { name: "Voorstel verwijderen" }).click();
      await pA.waitForURL((u) => u.pathname === "/te-controleren", {
        timeout: 20000,
      });
    }

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
    if (projectId) {
      // Bestanden in de opslag worden niet automatisch met het project
      // verwijderd: eerst de map van het project leegmaken.
      const { data: objecten } = await admin.storage
        .from("documenten")
        .list(projectId, { limit: 1000 });
      if (objecten?.length) {
        await admin.storage
          .from("documenten")
          .remove(objecten.map((o) => `${projectId}/${o.name}`));
      }
    }
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
             (select count(*) from public.projects where name = 'E2E-project ${sfx}') as projecten,
             (select count(*) from storage.objects
               where bucket_id = 'documenten'
                 and name like '${projectId ?? "geen-project"}/%') as bestanden`);
    ok(
      Number(rest[0].accounts) === 0 &&
        Number(rest[0].projecten) === 0 &&
        Number(rest[0].bestanden) === 0,
      "testaccounts, testproject en bestanden volledig verwijderd",
    );
  }

  console.log(`\n✓ End-to-end test geslaagd (${geslaagd} controles).`);
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
