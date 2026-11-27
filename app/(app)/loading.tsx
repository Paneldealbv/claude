/** Wordt getoond terwijl een pagina op de server wordt opgebouwd. */
export default function Laden() {
  return (
    <div
      className="space-y-6 lg:space-y-8"
      aria-busy="true"
      aria-live="polite"
      data-laden=""
    >
      <span className="sr-only">Laden…</span>
      <div className="space-y-2" aria-hidden="true">
        <div className="bg-surface-3 h-8 w-56 animate-pulse rounded-lg" />
        <div className="bg-surface-2 h-4 w-80 max-w-full animate-pulse rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="border-border bg-surface h-24 animate-pulse rounded-2xl border"
          />
        ))}
      </div>
      <div
        className="border-border bg-surface h-72 animate-pulse rounded-2xl border"
        aria-hidden="true"
      />
    </div>
  );
}
