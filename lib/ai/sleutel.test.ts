import { describe, expect, it } from "vitest";
import { schoneSleutel, sleutelGeweigerd } from "./sleutel";

const ECHT = `sk-ant-usr-${"a".repeat(90)}WXYZ`;

describe("schoneSleutel", () => {
  it("haalt meegeplakte spaties, quotes en regeleinden weg", () => {
    expect(schoneSleutel("  sk-ant-abc  ")).toBe("sk-ant-abc");
    expect(schoneSleutel('"sk-ant-abc"')).toBe("sk-ant-abc");
    expect(schoneSleutel("'sk-ant-abc'\n")).toBe("sk-ant-abc");
    expect(schoneSleutel("sk-ant-ab\nc")).toBe("sk-ant-abc");
  });

  it("haalt een meegeplakte variabelenaam weg", () => {
    expect(schoneSleutel("ANTHROPIC_API_KEY=sk-ant-abc")).toBe("sk-ant-abc");
    expect(schoneSleutel("ANTHROPIC_API_KEY = 'sk-ant-abc'")).toBe(
      "sk-ant-abc",
    );
  });

  it("geeft lege tekst zonder sleutel", () => {
    expect(schoneSleutel(undefined)).toBe("");
    expect(schoneSleutel("   ")).toBe("");
  });
});

describe("sleutelGeweigerd", () => {
  it("noemt alleen de laatste vier tekens van een echte sleutel", () => {
    const melding = sleutelGeweigerd(ECHT);
    expect(melding).toContain("eindigt op …WXYZ");
    expect(melding).toContain("opnieuw deployen");
    expect(melding).not.toContain("aaaa");
  });

  it("herkent iets dat geen sleutel is (naam of id)", () => {
    const melding = sleutelGeweigerd("apikey_01ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(melding).toContain("begint met sk-ant-");
    expect(melding).not.toContain("apikey_01");
  });

  it("herkent een onvolledige sleutel zonder iets ervan te tonen", () => {
    const melding = sleutelGeweigerd("sk-ant-usr-kort1234");
    expect(melding).toContain("onvolledig");
    expect(melding).not.toContain("1234");
  });
});
