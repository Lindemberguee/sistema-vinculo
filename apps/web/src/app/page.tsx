import Link from "next/link";
import { LinkButton } from "@/components/ui";

export default function MarketingHome() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <div className="mb-6 flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-6 place-items-center rounded-md bg-brand-600 text-white">♥</span>
        Plataforma de Doações
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">
        Arrecade mais, com menos trabalho.
      </h1>
      <p className="mt-3 text-muted">
        Páginas de campanha, checkout com Pix e cartão, split automático de repasse e um CRM de doadores — tudo em um só
        lugar para organizações do terceiro setor.
      </p>
      <div className="mt-6 flex gap-3">
        <LinkButton href="/onboarding">Cadastrar organização</LinkButton>
        <LinkButton href="/login" variant="secondary">
          Entrar
        </LinkButton>
      </div>
      <p className="mt-10 text-xs text-muted">
        Painel em <code>app.&lt;domínio&gt;</code> · back-office em <code>admin.&lt;domínio&gt;</code> · campanhas em{" "}
        <code>&lt;slug&gt;.&lt;domínio&gt;</code>.
      </p>
      <p className="mt-2 text-xs">
        <Link href="/login" className="link">
          Já tenho conta
        </Link>
      </p>
    </main>
  );
}
