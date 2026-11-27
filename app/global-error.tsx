"use client";

/**
 * Laatste vangnet als zelfs de basis van de app niet laadt. Staat los van
 * de gewone opmaak, dus met eigen eenvoudige stijlen.
 */
export default function GlobaleFout({ retry }: { retry: () => void }) {
  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f6f5f1",
          color: "#17181a",
        }}
      >
        <title>Er ging iets mis · Nieuwbouw Dashboard</title>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Er ging iets mis</h1>
          <p style={{ color: "#696b70", lineHeight: 1.5, margin: "0 0 20px" }}>
            De app kon niet worden geladen. Probeer het opnieuw.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: "#0f6b52",
              color: "#fff",
              border: 0,
              borderRadius: 12,
              padding: "10px 16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      </body>
    </html>
  );
}
