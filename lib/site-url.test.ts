import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { veiligPad } = await import("./site-url");

describe("veiligPad", () => {
  it.each([
    ["/budget", "/budget"],
    ["/uitnodiging/abc?x=1", "/uitnodiging/abc?x=1"],
  ])("staat intern pad %s toe", (invoer, verwacht) => {
    expect(veiligPad(invoer)).toBe(verwacht);
  });

  it.each([
    "https://kwaadaardig.nl",
    "//kwaadaardig.nl",
    "/\\kwaadaardig.nl",
    "javascript:alert(1)",
    "/\t/kwaadaardig.nl",
    "/\n/kwaadaardig.nl",
    "/\r\n/kwaadaardig.nl",
    "/budget\\..\\..\\kwaadaardig",
    " //kwaadaardig.nl",
    "",
    null,
    undefined,
  ])("weigert %j en valt terug op /dashboard", (invoer) => {
    expect(veiligPad(invoer)).toBe("/dashboard");
  });
});
