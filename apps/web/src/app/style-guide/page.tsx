import { notFound } from "next/navigation";
import { Bell, Inbox, Search } from "lucide-react";
import { contrast } from "@/blocks/accent";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DeltaBadge,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Select,
  Skeleton,
  Sparkline,
  Stat,
  StatusBadge,
  SummaryStrip,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { AlertDemo } from "./AlertDemo";

/**
 * Living style guide — the visual-QA surface for the design system.
 * Dev-only (or behind admin later); never shipped to production users.
 */
export const dynamic = "force-static";

const SWATCHES: { name: string; varName: string; hex: string; on?: string }[] = [
  { name: "brand-600", varName: "--color-brand-600", hex: "#006b4f", on: "#ffffff" },
  { name: "brand-500", varName: "--color-brand-500", hex: "#0d8061", on: "#ffffff" },
  { name: "brand-50", varName: "--color-brand-50", hex: "#eef6f2", on: "#075642" },
  { name: "accent-500", varName: "--color-accent-500", hex: "#c5a059", on: "#17201c" },
  { name: "ink", varName: "--color-ink", hex: "#17201c", on: "#ffffff" },
  { name: "muted", varName: "--color-muted", hex: "#616b66", on: "#ffffff" },
  { name: "faint", varName: "--color-faint", hex: "#6b756f", on: "#ffffff" },
  { name: "line", varName: "--color-line", hex: "#ececeb", on: "#17201c" },
  { name: "canvas", varName: "--color-canvas", hex: "#f8f8f6", on: "#17201c" },
  { name: "info", varName: "--color-info", hex: "#1f5f8b", on: "#ffffff" },
  { name: "success", varName: "--color-success", hex: "#16794c", on: "#ffffff" },
  { name: "warn", varName: "--color-warn", hex: "#8a6207", on: "#ffffff" },
  { name: "danger", varName: "--color-danger", hex: "#b3261e", on: "#ffffff" },
];

const TYPE_SCALE = [
  ["text-display", "Display — hero público"],
  ["text-title", "Title — h1 do painel"],
  ["text-heading", "Heading — seção"],
  ["text-subhead", "Subhead — título de card"],
  ["text-body", "Body — corpo público / e-mail"],
  ["text-ui", "UI — densidade do painel"],
  ["text-caption", "Caption — hint, legenda"],
  ["text-eyebrow", "Eyebrow — rótulo acima de número"],
] as const;

const ALL_STATUSES = [
  "DRAFT", "PUBLISHED", "PAUSED", "ACTIVE", "PENDING_KYC", "SUSPENDED",
  "PAID", "PENDING", "FAILED", "REFUNDED", "PAST_DUE", "CANCELED",
  "APPROVED", "REJECTED", "IN_REVIEW", "SUBMITTED", "DRAWN", "VALID",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-heading mb-4 border-b border-line pb-1.5">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleGuide() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-10">
        <h1 className="text-title">Style guide</h1>
        <p className="mt-1 text-sm text-muted">
          Fonte de aceite visual do sistema de design. Não vai para produção.
        </p>
      </header>

      <Section title="Paleta">
        <div className="grid gap-2 sm:grid-cols-2">
          {SWATCHES.map((s) => {
            const cOnWhite = contrast(s.hex, "#ffffff");
            return (
              <div key={s.name} className="flex items-center gap-3 rounded-lg border border-line p-2">
                <span
                  className="grid size-12 shrink-0 place-items-center rounded-md text-[0.6875rem] font-semibold"
                  style={{ background: s.hex, color: s.on }}
                >
                  Aa
                </span>
                <div className="min-w-0 text-xs">
                  <div className="font-medium">{s.name}</div>
                  <div className="font-mono text-muted">{s.hex}</div>
                  <div className="text-faint">contraste no branco: {cOnWhite.toFixed(1)}:1</div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Escala tipográfica">
        <div className="space-y-2">
          {TYPE_SCALE.map(([cls, desc]) => (
            <div key={cls} className="flex items-baseline gap-4">
              <span className={cls}>Doações que transformam</span>
              <span className="text-caption text-faint">
                <code>{cls}</code> · {desc}
              </span>
            </div>
          ))}
          <div className="flex items-baseline gap-4">
            <span className="text-num text-2xl">R$ 128.480</span>
            <span className="text-caption text-faint">
              <code>text-num</code> — tabular + tracking, sem tamanho próprio
            </span>
          </div>
        </div>
      </Section>

      <Section title="Botões">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Perigo</Button>
          <Button size="sm">Pequeno</Button>
          <Button loading>Carregando</Button>
          <Button disabled>Desabilitado</Button>
          <Button size="icon" aria-label="Buscar" variant="secondary">
            <Search className="size-4" />
          </Button>
          <LinkButton href="#">LinkButton</LinkButton>
        </div>
      </Section>

      <Section title="Campos">
        <div className="grid max-w-md gap-4">
          <Field label="Padrão" hint="Um texto de ajuda discreto.">
            <Input placeholder="valor…" />
          </Field>
          <Field label="Obrigatório" required>
            <Input />
          </Field>
          <Field label="Com erro" error="Esse endereço já está em uso.">
            <Input defaultValue="doe@ong" />
          </Field>
          <Field label="Confirmado" success="Domínio verificado.">
            <Input defaultValue="mail.ong.org.br" />
          </Field>
          <Field label="Desabilitado">
            <Input disabled defaultValue="—" />
          </Field>
          <Field label="Select">
            <Select>
              <option>Opção A</option>
              <option>Opção B</option>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Badges e status">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge>neutral</Badge>
          <Badge tone="info">info</Badge>
          <Badge tone="success">success</Badge>
          <Badge tone="warn">warn</Badge>
          <Badge tone="danger">danger</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section title="Alertas">
        <div className="space-y-3">
          <Alert tone="info" icon={<Bell className="size-4" />} title="Aviso informativo">
            Um contexto útil, sem urgência.
          </Alert>
          <Alert tone="warn">Aviso simples, só texto (compatível com o uso atual).</Alert>
          <Alert tone="danger" title="Algo falhou">
            Descrição do problema e o que fazer.
          </Alert>
          <AlertDemo />
        </div>
      </Section>

      <Section title="Estado vazio">
        <EmptyState
          icon={<Inbox className="size-5" />}
          title="Nenhuma mensagem ainda"
          action={<Button size="sm">Nova mensagem</Button>}
        >
          Comece criando a primeira comunicação para um segmento.
        </EmptyState>
      </Section>

      <Section title="Números (Stat / SummaryStrip / Sparkline / Delta)">
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Stat label="Arrecadado" value="R$ 128.480" dot="brand" deltaPct={12.4} sub="vs. período anterior" />
          <Stat label="Doadores" value="1.204" dot="accent" deltaPct={-3.1} />
          <Stat label="Recorrência" value="38%" dot="success" spark={[3, 5, 4, 6, 8, 7, 9]} />
        </div>
        <SummaryStrip
          stats={[
            { label: "Transações", value: 842 },
            { label: "Ticket médio", value: "R$ 152" },
            { label: "Reembolsos", value: 4 },
          ]}
          segments={[
            { label: "Recorrente", value: 60, color: "bg-brand-500" },
            { label: "Avulso", value: 40, color: "bg-accent-400" },
          ]}
        />
        <div className="mt-4 flex items-center gap-3">
          <DeltaBadge pct={9.2} />
          <DeltaBadge pct={-4.7} />
          <DeltaBadge pct={null} />
          <Sparkline data={[2, 4, 3, 6, 5, 8, 7, 9, 8]} className="w-40" />
        </div>
      </Section>

      <Section title="Tabela">
        <Card className="overflow-hidden">
          <CardHeader title="Densidade normal + cabeçalho ordenável" />
          <Table>
            <thead>
              <Tr>
                <Th sortable sorted="descending">Nome</Th>
                <Th sortable>Valor</Th>
                <Th>Status</Th>
              </Tr>
            </thead>
            <tbody>
              <Tr>
                <Td>Maria Silva</Td>
                <Td className="text-num">R$ 50,00</Td>
                <Td><StatusBadge status="PAID" /></Td>
              </Tr>
              <Tr>
                <Td>João Souza</Td>
                <Td className="text-num">R$ 120,00</Td>
                <Td><StatusBadge status="PENDING" /></Td>
              </Tr>
            </tbody>
          </Table>
        </Card>
      </Section>

      <Section title="Skeleton">
        <div className="max-w-sm space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Section>
    </main>
  );
}
