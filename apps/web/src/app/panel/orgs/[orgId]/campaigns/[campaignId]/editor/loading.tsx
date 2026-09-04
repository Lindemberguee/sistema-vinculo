export default function Loading() {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-canvas" aria-busy="true" aria-label="Carregando editor">
      <div className="h-14 shrink-0 border-b border-line-strong bg-surface" />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[264px_minmax(0,1fr)_320px]">
        <div className="hidden border-r border-line-strong bg-surface lg:block" />
        <div className="min-h-0 animate-pulse p-6">
          <div className="mx-auto h-full max-w-[900px] rounded-lg border border-line bg-surface" />
        </div>
        <div className="hidden border-l border-line-strong bg-surface lg:block" />
      </div>
    </div>
  );
}
