import { Resend } from "resend";

/**
 * Thin wrapper over Resend's Domains API for the per-org "own sending domain"
 * flow. The org adds a subdomain, publishes the DNS records we hand back, and
 * we poll verification.
 */

export interface DomainRecord {
  type: string; // MX | TXT | CNAME
  name: string;
  value: string;
  ttl?: string;
  priority?: number;
}

/** Our normalised status. Maps EmailDomainStatus. */
export type DomainStatus = "NONE" | "PENDING" | "VERIFIED" | "FAILED";

export interface DomainInfo {
  id: string;
  name: string;
  status: DomainStatus;
  records: DomainRecord[];
}

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não está configurado — necessário para verificar domínios.");
  return new Resend(key);
}

function mapStatus(raw: string | undefined): DomainStatus {
  switch (raw) {
    case "verified":
      return "VERIFIED";
    case "failed":
      return "FAILED";
    case "not_started":
      return "NONE";
    default:
      return "PENDING"; // pending | temporary_failure | undefined
  }
}

interface RawRecord {
  record?: string;
  type?: string;
  name?: string;
  value?: string;
  ttl?: string | number;
  priority?: number;
}

function mapRecords(records: RawRecord[] | undefined): DomainRecord[] {
  return (records ?? []).map((r) => ({
    type: (r.type ?? "TXT").toUpperCase(),
    name: r.name ?? "",
    value: r.value ?? "",
    ttl: r.ttl != null ? String(r.ttl) : undefined,
    priority: r.priority,
  }));
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Resend: ${res.error.message}`);
  if (!res.data) throw new Error("Resend: resposta vazia");
  return res.data;
}

export async function createSendingDomain(name: string): Promise<DomainInfo> {
  const d = unwrap(
    await client().domains.create({ name, region: "sa-east-1" }),
  ) as { id: string; name: string; status?: string; records?: RawRecord[] };
  return { id: d.id, name: d.name, status: mapStatus(d.status), records: mapRecords(d.records) };
}

export async function getSendingDomain(id: string): Promise<DomainInfo> {
  const d = unwrap(await client().domains.get(id)) as {
    id: string;
    name: string;
    status?: string;
    records?: RawRecord[];
  };
  return { id: d.id, name: d.name, status: mapStatus(d.status), records: mapRecords(d.records) };
}

export async function triggerSendingDomainVerify(id: string): Promise<void> {
  unwrap(await client().domains.verify(id));
}

export async function removeSendingDomain(id: string): Promise<void> {
  unwrap(await client().domains.remove(id));
}
