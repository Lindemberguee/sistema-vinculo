export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-line" />
        <div className="h-4 w-72 rounded bg-line" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-28 p-5">
            <div className="h-3 w-20 rounded bg-line" />
            <div className="mt-3 h-6 w-24 rounded bg-line" />
          </div>
        ))}
      </div>
      <div className="card h-40" />
    </div>
  );
}
