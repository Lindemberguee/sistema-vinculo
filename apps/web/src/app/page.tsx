import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleDollarSign,
  HeartHandshake,
  Landmark,
  Megaphone,
  ReceiptText,
  Repeat2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from "lucide-react";

import { LinkButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Captação com clareza para o terceiro setor",
  description:
    "Crie campanhas, receba doações e cuide do relacionamento com seus apoiadores em uma plataforma feita para organizações brasileiras.",
};

const featureCards = [
  {
    icon: Megaphone,
    eyebrow: "Captação",
    title: "Campanhas que dão vontade de participar",
    description:
      "Monte páginas bonitas e objetivas, com Pix, cartão e recorrência. Publique um link pronto para compartilhar em qualquer canal.",
    accent: "bg-brand-50 text-brand-700",
  },
  {
    icon: UsersRound,
    eyebrow: "Relacionamento",
    title: "Cada doador merece continuidade",
    description:
      "Tenha histórico, segmentos e tarefas no mesmo lugar para transformar uma primeira doação em uma relação duradoura.",
    accent: "bg-[#eaf4f6] text-[#25657a]",
  },
  {
    icon: BarChart3,
    eyebrow: "Gestão",
    title: "Decisões baseadas no que está acontecendo",
    description:
      "Acompanhe arrecadação, ticket médio, recorrência e conversão sem juntar planilhas no fim do mês.",
    accent: "bg-[#f7f0df] text-[#785c20]",
  },
];

const workflow = [
  {
    step: "01",
    icon: Landmark,
    title: "Conecte sua conta",
    description: "Use seu próprio gateway Pagar.me. O dinheiro continua indo direto para a sua organização.",
  },
  {
    step: "02",
    icon: Workflow,
    title: "Construa sua campanha",
    description: "Escolha os blocos, conte a história e publique uma página responsiva sem depender de código.",
  },
  {
    step: "03",
    icon: HeartHandshake,
    title: "Cultive o vínculo",
    description: "Agradeça, segmente e acompanhe cada apoio com contexto para agir no momento certo.",
  },
];

const faqs = [
  {
    question: "A plataforma fica com uma parte das doações?",
    answer:
      "Não. No modelo conectado, a plataforma cobra uma licença mensal e não retém comissão sobre as doações. As tarifas do Pagar.me continuam sendo tratadas diretamente pelo gateway da organização.",
  },
  {
    question: "Preciso trocar o gateway que minha ONG já usa?",
    answer:
      "Não. A proposta é conectar a conta da própria organização, começando pelo Pagar.me, para manter o repasse e a relação financeira sob seu controle.",
  },
  {
    question: "Posso começar com uma campanha pequena?",
    answer:
      "Sim. Você pode começar com uma campanha, validar a comunicação e ampliar a operação conforme a sua base de apoiadores cresce.",
  },
  {
    question: "A plataforma também ajuda com doações recorrentes?",
    answer:
      "Sim. O checkout e o CRM foram pensados para doações pontuais e recorrentes, com histórico para a equipe acompanhar a relação ao longo do tempo.",
  },
];

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-3" aria-label="Doações, página inicial">
      <span className={`grid size-9 place-items-center rounded-xl text-base font-semibold shadow-[0_8px_20px_rgb(0_0_0/0.12)] transition-transform duration-200 group-hover:-rotate-3 ${dark ? "bg-brand-600 text-white" : "bg-white text-brand-700"}`}>
        ♥
      </span>
      <span className="leading-none">
        <span className={`block text-[0.95rem] font-semibold tracking-[-0.02em] ${dark ? "text-ink" : "text-white"}`}>Doações</span>
        <span className={`mt-1 block text-[0.65rem] font-medium uppercase tracking-[0.14em] ${dark ? "text-muted" : "text-white/55"}`}>
          para quem faz acontecer
        </span>
      </span>
    </Link>
  );
}

function DashboardPreview() {
  return (
    <div className="home-float relative mx-auto w-full max-w-[38rem] lg:mr-0" aria-label="Prévia do painel de gestão">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-brand-400/15 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[0.09] p-2 shadow-[0_30px_90px_rgb(0_0_0/0.28)] backdrop-blur-xl">
        <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#f8fbf9] text-ink">
          <div className="flex items-center justify-between border-b border-[#dfe8e3] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-xs text-white">♥</span>
              <span className="text-xs font-semibold">Visão geral</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-[#e9f4ed] px-2.5 py-1 text-[0.6rem] font-medium text-brand-700 sm:inline-flex">
                Conta conectada
              </span>
              <span className="size-6 rounded-full bg-[#d9e9e1]" />
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-[#e2ebe6] bg-white p-3">
                <p className="text-[0.58rem] font-medium text-[#75837c]">Arrecadado</p>
                <p className="mt-1 text-sm font-semibold tracking-[-0.03em] sm:text-base">R$ 84,7 mil</p>
                <p className="mt-1 text-[0.58rem] font-medium text-brand-600">+18,4%</p>
              </div>
              <div className="rounded-xl border border-[#e2ebe6] bg-white p-3">
                <p className="text-[0.58rem] font-medium text-[#75837c]">Doadores</p>
                <p className="mt-1 text-sm font-semibold tracking-[-0.03em] sm:text-base">418</p>
                <p className="mt-1 text-[0.58rem] font-medium text-brand-600">+32 este mês</p>
              </div>
              <div className="rounded-xl border border-[#e2ebe6] bg-white p-3">
                <p className="text-[0.58rem] font-medium text-[#75837c]">Recorrência</p>
                <p className="mt-1 text-sm font-semibold tracking-[-0.03em] sm:text-base">62%</p>
                <p className="mt-1 text-[0.58rem] font-medium text-[#7a6328]">em alta</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-xl border border-[#e2ebe6] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.6rem] font-medium text-[#75837c]">Arrecadação por mês</p>
                    <p className="mt-1 text-lg font-semibold tracking-[-0.04em]">R$ 22.430</p>
                  </div>
                  <span className="rounded-full bg-brand-50 px-2 py-1 text-[0.58rem] font-medium text-brand-700">6 meses</span>
                </div>
                <div className="mt-5 flex h-20 items-end gap-1.5 sm:gap-2" aria-hidden="true">
                  {[34, 44, 38, 58, 52, 73, 64, 88, 77, 100].map((height, index) => (
                    <span
                      key={height + index}
                      className="flex-1 rounded-t-md bg-brand-100 transition-colors first:bg-brand-300 last:bg-brand-600"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[0.55rem] text-[#87948e]">
                  <span>abr</span><span>mai</span><span>jun</span><span>jul</span><span>ago</span>
                </div>
              </div>
              <div className="rounded-xl border border-[#e2ebe6] bg-[#0b382d] p-4 text-white">
                <p className="text-[0.6rem] font-medium text-white/60">Campanha em destaque</p>
                <p className="mt-2 text-sm font-semibold leading-snug">Histórias que transformam</p>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full w-[71%] rounded-full bg-[#72d1ad]" />
                </div>
                <div className="mt-2 flex items-center justify-between text-[0.58rem] text-white/65">
                  <span>R$ 84.705</span><span>71%</span>
                </div>
                <div className="mt-5 flex items-center gap-2 text-[0.58rem] text-white/70">
                  <span className="grid size-5 place-items-center rounded-full bg-white/10"><Repeat2 className="size-3" /></span>
                  86 doadores recorrentes
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-dashed border-[#cbdcd3] bg-[#f5faf7] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-white text-brand-600 shadow-sm"><BadgeCheck className="size-4" /></span>
                <div>
                  <p className="text-[0.64rem] font-semibold">Tudo certo por aqui</p>
                  <p className="text-[0.57rem] text-[#75837c]">Última atualização há 4 minutos</p>
                </div>
              </div>
              <ArrowRight className="size-3.5 text-brand-600" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-4 -left-2 hidden items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs text-white shadow-xl backdrop-blur-xl sm:flex">
        <span className="grid size-6 place-items-center rounded-full bg-[#72d1ad]/20 text-[#b8f4d9]"><ShieldCheck className="size-3.5" /></span>
        Dados sob o controle da sua ONG
      </div>
    </div>
  );
}

export default function MarketingHome() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7fbf9] text-ink">
      <section className="relative isolate overflow-hidden bg-[#071f19] text-white">
        <div className="home-grid absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="home-ambient absolute -right-40 -top-48 size-[32rem]" aria-hidden="true" />
        <div className="home-ambient home-ambient--small absolute -bottom-56 left-[-10rem] size-[26rem]" aria-hidden="true" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-white/65 md:flex" aria-label="Navegação principal">
            <Link className="transition-colors hover:text-white" href="#recursos">Recursos</Link>
            <Link className="transition-colors hover:text-white" href="#como-funciona">Como funciona</Link>
            <Link className="transition-colors hover:text-white" href="#transparencia">Transparência</Link>
            <Link className="transition-colors hover:text-white" href="#duvidas">Dúvidas</Link>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/login" className="hidden min-h-10 items-center rounded-full px-3.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex">
              Entrar
            </Link>
            <Link href="/onboarding" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-brand-800 shadow-[0_8px_20px_rgb(0_0_0/0.16)] transition-transform hover:-translate-y-0.5 hover:bg-[#effaf4]">
              Começar agora <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-12 sm:px-8 md:pb-28 md:pt-20 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-16 lg:px-10 lg:pt-24">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-[#b8f4d9] backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-[#72d1ad] shadow-[0_0_0_4px_rgb(114_209_173/0.14)]" />
              Feito para o terceiro setor
            </div>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.06] tracking-[-0.045em] sm:text-5xl lg:text-[4.35rem]">
              Mais tempo para a causa. <span className="text-[#8fe1bf]">Mais clareza para captar.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
              Campanhas, checkout e relacionamento com doadores em um só lugar — com a sua conta, os seus dados e o seu jeito de fazer impacto.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/onboarding" className="min-h-12 bg-[#8fe1bf] px-5 text-sm font-semibold text-[#073b2d] shadow-[0_14px_30px_rgb(41_162_119/0.2)] hover:bg-[#b8f4d9]">
                Criar minha organização <ArrowRight className="size-4" aria-hidden="true" />
              </LinkButton>
              <LinkButton href="#recursos" variant="ghost" className="min-h-12 border border-white/15 px-5 text-sm text-white hover:bg-white/10 hover:text-white">
                Conhecer a plataforma
              </LinkButton>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2.5 text-xs text-white/55">
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-[#8fe1bf]" /> Sem comissão da plataforma</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-[#8fe1bf]" /> Pix, cartão e recorrência</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-[#8fe1bf]" /> Controle dos seus dados</span>
            </div>
          </div>
          <DashboardPreview />
        </div>

        <div className="relative z-10 border-t border-white/10 bg-white/[0.035]">
          <div className="mx-auto grid max-w-7xl gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Campanhas", "Páginas que contam sua história"],
              ["02", "Recorrência", "Apoio que continua no próximo mês"],
              ["03", "Relacionamento", "Contexto para cuidar de cada doador"],
              ["04", "Prestação de contas", "Visão clara do que está acontecendo"],
            ].map(([number, title, description]) => (
              <div key={number} className="bg-[#071f19] px-5 py-5 sm:px-8 lg:px-10">
                <p className="font-mono text-[0.62rem] text-[#72d1ad]">{number}</p>
                <p className="mt-2 text-sm font-medium text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-white/45">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-20 sm:px-8 md:py-28 lg:px-10">
        <div className="max-w-2xl">
          <p className="eyebrow text-brand-600">Uma operação mais leve</p>
          <h2 className="mt-3 max-w-xl text-3xl leading-tight tracking-[-0.04em] sm:text-4xl">Tudo o que a sua equipe precisa para cuidar do apoio.</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">Menos retrabalho para a equipe. Mais consistência em cada ponto de contato com quem acredita na sua causa.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {featureCards.map(({ icon: Icon, eyebrow, title, description, accent }) => (
            <article key={title} className="group rounded-2xl border border-[#dce9e2] bg-white p-6 shadow-[0_1px_2px_rgb(20_24_22/0.03)] transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-[0_18px_40px_rgb(20_60_42/0.08)] sm:p-7">
              <span className={`grid size-11 place-items-center rounded-2xl ${accent}`}><Icon className="size-5" aria-hidden="true" /></span>
              <p className="mt-8 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{eyebrow}</p>
              <h3 className="mt-2 text-xl leading-snug tracking-[-0.025em]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
              <Link href="#como-funciona" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 transition-all group-hover:gap-2.5">Ver como funciona <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            </article>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-8 border-y border-[#dce9e2] bg-[#edf6f1]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 md:py-28 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <p className="eyebrow text-brand-600">Do primeiro acesso ao impacto</p>
              <h2 className="mt-3 text-3xl leading-tight tracking-[-0.04em] sm:text-4xl">Comece simples. Evolua no seu ritmo.</h2>
              <p className="mt-4 max-w-md text-base leading-7 text-muted">A plataforma acompanha a maturidade da sua captação sem colocar burocracia no caminho.</p>
              <Link href="/onboarding" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800">
                Criar uma conta gratuita <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {workflow.map(({ step, icon: Icon, title, description }) => (
                <article key={step} className="relative rounded-2xl border border-[#d5e5dc] bg-white/75 p-5 backdrop-blur-sm sm:p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white"><Icon className="size-4" aria-hidden="true" /></span>
                    <span className="font-mono text-[0.66rem] font-medium text-brand-500">{step}</span>
                  </div>
                  <h3 className="mt-7 text-lg tracking-[-0.02em]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="transparencia" className="scroll-mt-8 bg-[#f7fbf9] px-5 py-20 sm:px-8 md:py-28 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-[#092a20] p-7 text-white shadow-[0_24px_70px_rgb(10_69_54/0.18)] sm:p-10">
            <div className="home-grid absolute inset-0 opacity-35" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-xl bg-[#8fe1bf] text-sm text-[#073b2d]">♥</span><span className="text-sm font-medium">Sua captação, no seu controle</span></div>
                <ShieldCheck className="size-5 text-[#8fe1bf]" aria-hidden="true" />
              </div>
              <div className="mt-10 grid gap-8 sm:grid-cols-2">
                <div>
                  <p className="text-[0.67rem] uppercase tracking-[0.12em] text-white/50">Comissão da plataforma</p>
                  <p className="mt-2 text-5xl font-semibold tracking-[-0.06em] text-[#8fe1bf]">0<span className="text-3xl">%</span></p>
                  <p className="mt-2 max-w-[13rem] text-sm leading-6 text-white/60">A mensalidade é previsível. A tarifa do gateway fica separada.</p>
                </div>
                <div className="space-y-4">
                  {["Conta Pagar.me da organização", "Histórico e exportação", "Recibos e prestação de contas"].map((item) => (
                    <div key={item} className="flex items-center gap-2.5 text-sm text-white/78"><span className="grid size-5 place-items-center rounded-full bg-white/10"><Check className="size-3 text-[#8fe1bf]" /></span>{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div>
            <p className="eyebrow text-brand-600">Transparência como base</p>
            <h2 className="mt-3 max-w-xl text-3xl leading-tight tracking-[-0.04em] sm:text-4xl">A confiança começa antes do clique em “doar”.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted">Sua página pública explica o impacto. Seu painel mostra o caminho do dinheiro. E sua equipe tem o contexto para prestar contas com tranquilidade.</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <div className="border-l-2 border-brand-300 pl-4"><ReceiptText className="size-5 text-brand-600" aria-hidden="true" /><p className="mt-3 text-sm font-semibold">Recibos claros</p><p className="mt-1 text-sm leading-6 text-muted">Uma confirmação que respeita o doador e a causa.</p></div>
              <div className="border-l-2 border-brand-300 pl-4"><CircleDollarSign className="size-5 text-brand-600" aria-hidden="true" /><p className="mt-3 text-sm font-semibold">Repasse direto</p><p className="mt-1 text-sm leading-6 text-muted">A organização mantém a relação com o próprio gateway.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dce9e2] bg-white px-5 py-20 sm:px-8 md:py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl"><p className="eyebrow text-brand-600">Para cada fase da sua organização</p><h2 className="mt-3 text-3xl leading-tight tracking-[-0.04em] sm:text-4xl">Uma licença que acompanha seu crescimento.</h2></div>
            <p className="max-w-xs text-sm leading-6 text-muted md:text-right">Comece com o essencial e adicione recursos quando a operação pedir. Sem taxa sobre cada doação.</p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {["Campanhas e checkout", "CRM de doadores", "Eventos, rifas e leilões", "Relatórios e exportações"].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-[#dce9e2] bg-[#f8fbf9] px-4 py-4 text-sm font-medium"><span className="font-mono text-[0.65rem] text-brand-500">0{index + 1}</span>{item}</div>
            ))}
          </div>
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#f2f8f4] px-5 py-5 sm:flex-row sm:items-center sm:px-6"><div className="flex items-center gap-3"><Sparkles className="size-5 text-[#a9863f]" aria-hidden="true" /><p className="text-sm text-muted">Sem contrato longo. Sem surpresa no repasse.</p></div><Link href="/onboarding" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">Conhecer os planos <ArrowRight className="size-4" aria-hidden="true" /></Link></div>
        </div>
      </section>

      <section id="duvidas" className="mx-auto max-w-4xl scroll-mt-8 px-5 py-20 sm:px-8 md:py-28">
        <div className="text-center"><p className="eyebrow text-brand-600">Perguntas frequentes</p><h2 className="mt-3 text-3xl tracking-[-0.04em] sm:text-4xl">Antes de começar, tudo bem claro.</h2></div>
        <div className="mt-10 divide-y divide-[#dce9e2] rounded-2xl border border-[#dce9e2] bg-white px-5 sm:px-7">
          {faqs.map(({ question, answer }) => (
            <details key={question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-left text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden"><span>{question}</span><ChevronDown className="size-4 shrink-0 text-brand-600 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" /></summary>
              <p className="max-w-3xl pr-8 pt-3 text-sm leading-6 text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 md:pb-28 lg:px-10">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[1.75rem] bg-[#0b382d] px-6 py-12 text-center text-white sm:px-10 sm:py-16">
          <div className="home-grid absolute inset-0 opacity-35" aria-hidden="true" />
          <div className="relative mx-auto max-w-2xl"><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8fe1bf]">O próximo passo cabe na sua agenda</p><h2 className="mt-4 text-3xl leading-tight tracking-[-0.04em] sm:text-4xl">Sua causa já tem uma história. Vamos ajudar mais pessoas a fazer parte dela?</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">Crie sua organização, monte a primeira campanha e veja a plataforma trabalhando com você.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><LinkButton href="/onboarding" className="min-h-12 bg-[#8fe1bf] px-5 font-semibold text-[#073b2d] hover:bg-[#b8f4d9]">Começar gratuitamente <ArrowRight className="size-4" aria-hidden="true" /></LinkButton><LinkButton href="/login" variant="ghost" className="min-h-12 border border-white/15 px-5 text-white hover:bg-white/10 hover:text-white">Já tenho uma conta</LinkButton></div></div>
        </div>
      </section>

      <footer className="border-t border-[#dce9e2] bg-white px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between"><Logo dark /><div className="flex flex-wrap items-center gap-x-5 gap-y-2"><Link href="#recursos" className="hover:text-ink">Recursos</Link><Link href="#duvidas" className="hover:text-ink">Dúvidas</Link><Link href="/login" className="hover:text-ink">Entrar</Link><span>© {new Date().getFullYear()} Doações</span></div></div>
      </footer>
    </main>
  );
}
