export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse bg-surface" aria-busy="true" aria-label="Carregando">
      <div className="h-64 bg-canvas" />
      <div className="mx-auto max-w-2xl space-y-4 px-6 py-10">
        <div className="h-6 w-2/3 rounded bg-canvas" />
        <div className="h-4 w-full rounded bg-canvas" />
        <div className="h-4 w-5/6 rounded bg-canvas" />
        <div className="mt-8 h-64 rounded-xl bg-canvas" />
      </div>
    </div>
  );
}
