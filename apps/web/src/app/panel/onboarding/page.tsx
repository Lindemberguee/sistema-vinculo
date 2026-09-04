import { requireUserPage } from "@/server/auth-helpers";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { PageHeader } from "@/components/ui";

export default async function OnboardingPage() {
  await requireUserPage();
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        title="Cadastrar organização"
        description="Depois do envio, o cadastro passa por análise (KYC). Você já pode montar campanhas, mas elas só ficam no ar quando a organização é aprovada."
        back={{ href: "/", label: "Painel" }}
      />
      <OnboardingWizard />
    </main>
  );
}
