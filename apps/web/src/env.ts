import { z } from "zod";

/**
 * Validated environment. Import from here, never read `process.env` directly
 * in app code. Fails fast at boot if something required is missing.
 */
// Treat an empty string (e.g. `S3_ENDPOINT=` in .env) as "not set".
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), inner.optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  /** "on" activates Postgres RLS pinning in tenantPrisma. Off until sql/rls.sql is applied. */
  DB_RLS: z.enum(["on", "off"]).default("off"),

  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url(),

  APP_BASE_DOMAIN: z.string().min(3), // e.g. "localhost:3000" or "doacoes.com.br"

  /**
   * Public origin that inbound provider webhooks should hit (e.g. a Cloudflare
   * tunnel in dev, or the real domain in prod). When set, the Pagamentos page
   * shows `${this}/api/webhooks/...` instead of guessing from the request host.
   * No trailing slash.
   */
  PUBLIC_WEBHOOK_BASE_URL: optional(z.string().url()),

  /** Set to "mock" for local dev / E2E — uses an in-process fake gateway. */
  PAYMENTS_GATEWAY: optional(z.enum(["mock"])),

  // Platform Pagar.me account — only needed for the MANAGED (facilitator + split)
  // plan. A pure BYOG deployment (orgs connect their own gateway) can omit these.
  PAGARME_SECRET_KEY: optional(z.string().min(8)),
  PAGARME_PUBLIC_KEY: optional(z.string().min(8)),
  PAGARME_WEBHOOK_SECRET: optional(z.string().min(8)),
  PLATFORM_RECIPIENT_ID: optional(z.string().min(3)),

  // International donations (Stripe). Optional — the intl checkout stays hidden
  // until these are set.
  STRIPE_SECRET_KEY: optional(z.string()),
  STRIPE_WEBHOOK_SECRET: optional(z.string()),

  RESEND_API_KEY: optional(z.string()),
  EMAIL_FROM: z.string().default("Doações <no-reply@example.com>"),
  /** Platform sending domain, e.g. "envios.suaplataforma.com.br". Address becomes no-reply@<this>. */
  EMAIL_SENDING_DOMAIN: optional(z.string()),
  /** Resend (Svix) webhook signing secret for bounce/complaint handling. */
  RESEND_WEBHOOK_SECRET: optional(z.string()),
  /** 32-byte base64 key for encrypting connected-gateway secrets at rest. */
  PAYMENTS_ENC_KEY: optional(z.string()),
  SENTRY_DSN: optional(z.string()),
  GOOGLE_CLIENT_ID: optional(z.string()),
  GOOGLE_CLIENT_SECRET: optional(z.string()),

  // Object storage (R2 / S3 / MinIO). Optional — KYC uploads and CSV export
  // downloads are disabled until these are set.
  S3_ENDPOINT: optional(z.string().url()),
  S3_BUCKET: optional(z.string().min(1)),
  S3_ACCESS_KEY_ID: optional(z.string().min(1)),
  S3_SECRET_ACCESS_KEY: optional(z.string().min(1)),
  S3_REGION: z.string().default("us-east-1"),

  /** Comma-separated e-mails allowed into the platform back-office. */
  PLATFORM_ADMIN_EMAILS: z.string().default(""),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

/** Public values safe to expose to the browser. */
export const publicEnv = {
  pagarmePublicKey: env.PAGARME_PUBLIC_KEY ?? "",
  appBaseDomain: env.APP_BASE_DOMAIN,
} as const;

export const platformAdminEmails = new Set(
  env.PLATFORM_ADMIN_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export const isStorageConfigured = Boolean(
  env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
);

export const isIntlEnabled = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
