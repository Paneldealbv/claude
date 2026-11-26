import { describe, expect, it } from "vitest";
import { isGeldigeIsoDatum, isoNaarNl, parseDatum, vandaagIso } from "./datum";

describe("parseDatum", () => {
  it.each([
    ["15-05-2027", "2027-05-15"],
    ["15-5-2027", "2027-05-15"],
    ["1-5-2027", "2027-05-01"],
    ["15/05/2027", "2027-05-15"],
    ["15.05.2027", "2027-05-15"],
    ["15 5 2027", "2027-05-15"],
    [" 15 - 05 - 2027 ", "2027-05-15"],
    ["15052027", "2027-05-15"],
    ["150527", "2027-05-15"],
    ["15-05-27", "2027-05-15"],
    ["29-02-2028", "2028-02-29"],
    ["31-12-2026", "2026-12-31"],
  ])("%j → %s", (invoer, verwacht) => {
    expect(parseDatum(invoer)).toBe(verwacht);
  });

  it.each([
    "",
    "   ",
    "29-02-2027", // geen schrikkeljaar
    "31-04-2027", // april heeft 30 dagen
    "00-05-2027",
    "15-13-2027",
    "2027-05-15", // ISO-volgorde is geen Nederlandse invoer
    "15-05-202",
    "123-05-2027",
    "15-05-1800",
    "morgen",
    "15-05",
    "1505202",
  ])("weigert %j", (invoer) => {
    expect(parseDatum(invoer)).toBeNull();
  });
});

describe("isoNaarNl en isGeldigeIsoDatum", () => {
  it("zet ISO om naar DD-MM-JJJJ", () => {
    expect(isoNaarNl("2027-05-15")).toBe("15-05-2027");
  });
  it("geeft leeg terug bij lege of ongeldige waarde", () => {
    expect(isoNaarNl(null)).toBe("");
    expect(isoNaarNl("ongeldig")).toBe("");
    expect(isoNaarNl("2027-02-30")).toBe("");
  });
  it("controleert of een ISO-datum echt bestaat", () => {
    expect(isGeldigeIsoDatum("2028-02-29")).toBe(true);
    expect(isGeldigeIsoDatum("2027-02-29")).toBe(false);
    expect(isGeldigeIsoDatum("2027-5-15")).toBe(false);
  });
});

describe("vandaagIso", () => {
  it("gebruikt de Nederlandse kalenderdag", () => {
    // 23:30 UTC op 31 december is in Amsterdam al 1 januari.
    expect(vandaagIso(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(vandaagIso(new Date("2026-06-15T10:00:00Z"))).toBe("2026-06-15");
  });
});
