import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, maakNonce } from "./csp";

const opties = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  https: true,
  dev: false,
};

describe("contentSecurityPolicy", () => {
  it("scripts alleen met de nonce van dit verzoek, nooit inline of eval", () => {
    const csp = contentSecurityPolicy("abc123", opties);
    const scripts = csp.split("; ").find((d) => d.startsWith("script-src"));
    expect(scripts).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("opslag en uploads alleen naar de eigen Supabase", () => {
    const csp = contentSecurityPolicy("n", opties);
    expect(csp).toContain(
      "img-src 'self' blob: data: https://abcdefgh.supabase.co",
    );
    expect(csp).toContain("frame-src 'self' https://abcdefgh.supabase.co");
    expect(csp).toContain(
      "connect-src 'self' https://abcdefgh.supabase.co wss://abcdefgh.supabase.co",
    );
  });

  it("upgrade-insecure-requests alleen via https; eval alleen in ontwikkeling", () => {
    expect(contentSecurityPolicy("n", opties)).toContain(
      "upgrade-insecure-requests",
    );
    const lokaal = contentSecurityPolicy("n", {
      ...opties,
      https: false,
      dev: true,
    });
    expect(lokaal).not.toContain("upgrade-insecure-requests");
    expect(lokaal).toContain("'unsafe-eval'");
  });

  it("elke nonce is anders", () => {
    expect(maakNonce()).not.toBe(maakNonce());
    expect(maakNonce()).toMatch(/^[A-Za-z0-9+/=]{40,}$/);
  });
});
