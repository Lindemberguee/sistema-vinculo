export default function SiteNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-3xl">🔎</p>
        <h1 className="mt-3 text-lg font-semibold">Página não encontrada</h1>
        <p className="mt-1 text-sm text-muted">
          O link pode estar incorreto ou a campanha não está mais no ar.
        </p>
      </div>
    </div>
  );
}
