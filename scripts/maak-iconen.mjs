#!/usr/bin/env node
/**
 * Maakt de app-iconen uit het logo (zelfde vorm als <Logo/> in de zijbalk):
 *   public/icon-192.png, public/icon-512.png      afgeronde tegel ("any")
 *   public/icon-maskable-512.png                  volle tegel ("maskable")
 *   public/apple-touch-icon.png (180)             volle tegel (iOS rondt zelf af)
 *   app/icon.svg                                  favicon (vector)
 *   app/favicon.ico                               16 + 32 px (PNG in ICO)
 *
 * Gebruik: node scripts/maak-iconen.mjs  (rendert met de meegeleverde Chromium)
 */
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const GOUD = "#c9a45c";
const DONKER = "#1b1508";
const HUIS =
  "M9 15.2 16 9.5l7 5.7V23a1 1 0 0 1-1 1h-4v-5h-4v5h-4a1 1 0 0 1-1-1z";

/** Logo als SVG; afgerond (rx 9 op 32) of tot de rand gevuld. */
const svg = (afgerond) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
  `<rect width="32" height="32" rx="${afgerond ? 9 : 0}" fill="${GOUD}"/>` +
  `<path d="${HUIS}" fill="${DONKER}"/></svg>`;

async function main() {
  const browser = await chromium.launch();
  const pagina = await browser.newPage();
  const png = async (afgerond, grootte) => {
    await pagina.setViewportSize({ width: grootte, height: grootte });
    await pagina.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${grootte}px;height:${grootte}px}</style>${svg(afgerond)}`,
    );
    return pagina.screenshot({ omitBackground: true, type: "png" });
  };

  await writeFile("public/icon-192.png", await png(true, 192));
  await writeFile("public/icon-512.png", await png(true, 512));
  await writeFile("public/icon-maskable-512.png", await png(false, 512));
  await writeFile("public/apple-touch-icon.png", await png(false, 180));
  await writeFile("app/icon.svg", svg(true));

  // ICO met twee PNG-afbeeldingen (16 en 32 px).
  const delen = [await png(true, 16), await png(true, 32)];
  const kop = Buffer.alloc(6 + 16 * delen.length);
  kop.writeUInt16LE(0, 0); // gereserveerd
  kop.writeUInt16LE(1, 2); // type: icoon
  kop.writeUInt16LE(delen.length, 4);
  let positie = kop.length;
  delen.forEach((data, i) => {
    const grootte = i === 0 ? 16 : 32;
    const o = 6 + 16 * i;
    kop.writeUInt8(grootte, o); // breedte
    kop.writeUInt8(grootte, o + 1); // hoogte
    kop.writeUInt8(0, o + 2); // kleurenpalet
    kop.writeUInt8(0, o + 3); // gereserveerd
    kop.writeUInt16LE(1, o + 4); // kleurvlakken
    kop.writeUInt16LE(32, o + 6); // bits per pixel
    kop.writeUInt32LE(data.length, o + 8);
    kop.writeUInt32LE(positie, o + 12);
    positie += data.length;
  });
  await writeFile("app/favicon.ico", Buffer.concat([kop, ...delen]));

  await browser.close();
  console.log("✓ iconen gemaakt");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
