"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@donation/db";
import { isAppError } from "@donation/shared";
import { getGateway, type OrgKycData } from "@donation/payments";
import { requireOrgAccess, requireUser } from "@/server/auth-helpers";

export interface OnboardingResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  organizationId?: string;
  kycQueued?: boolean;
}

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const digits = (s: string) => s.replace(/\D/g, "");

const orgBasicsSchema = z.object({
  legalName: z.string().min(3).max(160),
  displayName: z.string().min(2).max(80),
  cnpj: z.string().transform(digits).pipe(z.string().length(14, "CNPJ deve ter 14 dígitos")),
  slug: z.string().min(2).max(63).regex(slugRe, "Use apenas letras minúsculas, números e hífens"),
  contactEmail: z.string().email(),
  contactPhone: z.string().transform(digits).pipe(z.string().min(10).max(11)),
  addressStreet: z.string().min(2),
  addressNumber: z.string().min(1),
  addressNeighborhood: z.string().min(2),
  addressCity: z.string().min(2),
  addressState: z.string().length(2),
  addressZip: z.string().transform(digits).pipe(z.string().length(8)),
});

/** Step 1 → creates the org (PENDING_KYC), OWNER membership, free subscription, KYC draft. */
export async function createDraftOrganization(formData: FormData): Promise<OnboardingResult> {
  const user = await requireUser();
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true } });
  if (!account?.emailVerified) {
    return { ok: false, error: "Confirme seu e-mail antes de cadastrar uma organização." };
  }
  const parsed = orgBasicsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  try {
    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          slug: d.slug,
          legalName: d.legalName,
          displayName: d.displayName,
          cnpj: d.cnpj,
          status: "PENDING_KYC",
          kycStatus: "NOT_STARTED",
          planId: "free",
        },
        select: { id: true },
      });

      await tx.membership.create({ data: { userId: user.id, organizationId: created.id, role: "OWNER" } });

      await tx.subscription.create({
        data: {
          organizationId: created.id,
          planId: "free",
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        },
      });

      await tx.organizationKyc.create({
        data: {
          organizationId: created.id,
          contactEmail: d.contactEmail,
          contactPhone: d.contactPhone,
          address: {
            street: d.addressStreet,
            number: d.addressNumber,
            neighborhood: d.addressNeighborhood,
            city: d.addressCity,
            state: d.addressState.toUpperCase(),
            zipCode: d.addressZip,
          },
          legalRepName: "",
          legalRepDocument: "",
          bankAccount: {},
        },
      });

      await tx.auditLog.create({
        data: { organizationId: created.id, userId: user.id, action: "org.created", entity: "Organization", entityId: created.id, diff: {} },
      });

      return created;
    });

    return { ok: true, organizationId: org.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = String((err.meta as { target?: string[] } | undefined)?.target ?? "");
      if (target.includes("slug")) return { ok: false, fieldErrors: { slug: ["Endereço já em uso"] } };
      if (target.includes("cnpj")) return { ok: false, fieldErrors: { cnpj: ["Já existe uma organização com este CNPJ"] } };
    }
    throw err;
  }
}

const docSchema = z.object({
  kind: z.enum(["ESTATUTO", "ATA", "CARTAO_CNPJ", "DOC_RESPONSAVEL", "COMPROVANTE_BANCARIO"]),
  storageKey: z.string().min(4),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
});

/** Called after the browser has PUT the file to storage. */
export async function registerKycDocument(
  organizationId: string,
  input: z.input<typeof docSchema>,
): Promise<OnboardingResult> {
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "ADMIN");
    const d = docSchema.parse(input);

    // One current document per kind — replace any previous.
    await db.kycDocument.deleteMany({ where: { kind: d.kind } });
    await db.kycDocument.create({
      data: {
        organizationId,
        kind: d.kind,
        storageKey: d.storageKey,
        contentType: d.contentType,
        sizeBytes: d.sizeBytes,
        uploadedBy: userId,
      },
    });
    return { ok: true, organizationId };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

const submitSchema = z.object({
  legalRepName: z.string().min(3).max(120),
  legalRepDocument: z.string().transform(digits).pipe(z.string().length(11, "CPF deve ter 11 dígitos")),
  bankCode: z.string().transform(digits).pipe(z.string().min(3).max(3)),
  branchNumber: z.string().transform(digits).pipe(z.string().min(1).max(5)),
  accountNumber: z.string().transform(digits).pipe(z.string().min(1).max(13)),
  accountCheckDigit: z.string().transform(digits).pipe(z.string().min(1).max(2)),
  accountType: z.enum(["checking", "savings"]),
  acceptTerms: z.literal("true"),
});

const REQUIRED_DOCS = ["ESTATUTO", "CARTAO_CNPJ", "DOC_RESPONSAVEL", "COMPROVANTE_BANCARIO"] as const;

/** Final step → persist rep + bank data, create the Pagar.me recipient (best effort). */
export async function submitOnboarding(organizationId: string, formData: FormData): Promise<OnboardingResult> {
  let kycQueued = false;
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "OWNER");
    const parsed = submitSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const d = parsed.data;

    const org = await db.organization.findFirst({
      where: { id: organizationId },
      select: { legalName: true, cnpj: true, kyc: true, kycDocuments: { select: { kind: true } } },
    });
    if (!org?.kyc) return { ok: false, error: "Complete os passos anteriores primeiro" };

    const uploaded = new Set(org.kycDocuments.map((x) => x.kind));
    const missing = REQUIRED_DOCS.filter((k) => !uploaded.has(k));
    if (missing.length) return { ok: false, error: `Faltam documentos: ${missing.join(", ")}` };

    const bankAccount = {
      bankCode: d.bankCode,
      branchNumber: d.branchNumber,
      accountNumber: d.accountNumber,
      accountCheckDigit: d.accountCheckDigit,
      type: d.accountType,
    };

    await db.organizationKyc.update({
      where: { organizationId },
      data: {
        legalRepName: d.legalRepName,
        legalRepDocument: d.legalRepDocument,
        bankAccount,
        acceptedTermsAt: new Date(),
        submittedAt: new Date(),
      },
    });
    await db.organization.update({ where: { id: organizationId }, data: { kycStatus: "SUBMITTED" } });

    // Best effort: creating the recipient needs live Pagar.me credentials.
    const addr = org.kyc.address as Record<string, string>;
    const kycData: OrgKycData = {
      organizationId,
      legalName: org.legalName,
      cnpj: org.cnpj,
      email: org.kyc.contactEmail,
      phone: org.kyc.contactPhone,
      address: {
        street: addr.street ?? "",
        number: addr.number ?? "",
        zipCode: addr.zipCode ?? "",
        city: addr.city ?? "",
        state: addr.state ?? "",
        neighborhood: addr.neighborhood ?? "",
      },
      bankAccount: {
        bankCode: d.bankCode,
        branchNumber: d.branchNumber,
        accountNumber: d.accountNumber,
        accountCheckDigit: d.accountCheckDigit,
        holderName: d.legalRepName,
        holderDocument: org.cnpj,
        type: d.accountType,
      },
    };

    try {
      const { recipientId } = await getGateway().createRecipient(kycData);
      await db.organization.update({
        where: { id: organizationId },
        data: { gatewayRecipientId: recipientId, kycStatus: "IN_REVIEW" },
      });
      kycQueued = true;
    } catch (gwErr) {
      console.warn("createRecipient failed (will retry from panel):", gwErr instanceof Error ? gwErr.message : gwErr);
    }

    await db.auditLog.create({
      data: { organizationId, userId, action: "kyc.submitted", entity: "Organization", entityId: organizationId, diff: {} },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath(`/panel/orgs/${organizationId}`);
  return { ok: true, organizationId, kycQueued };
}

/** Panel button: pull the current KYC status from the gateway. */
export async function refreshKycStatus(organizationId: string): Promise<OnboardingResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const org = await db.organization.findFirst({
      where: { id: organizationId },
      select: { gatewayRecipientId: true },
    });
    if (!org?.gatewayRecipientId) {
      // No recipient yet → try to (re)create it via submit path is simpler; just report.
      return { ok: false, error: "Ainda não há um recebedor criado. Reenvie o cadastro." };
    }

    const status = await getGateway().getRecipientStatus(org.gatewayRecipientId);
    const kycStatus = status === "APPROVED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : "IN_REVIEW";

    await db.organization.update({
      where: { id: organizationId },
      data: { kycStatus, status: kycStatus === "APPROVED" ? "ACTIVE" : undefined },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}`);
  return { ok: true, organizationId };
}

/** `useActionState` adapters. */
export async function createDraftOrganizationFormAction(
  _prev: OnboardingResult | null,
  formData: FormData,
): Promise<OnboardingResult> {
  return createDraftOrganization(formData);
}

export async function submitOnboardingFormAction(
  organizationId: string,
  _prev: OnboardingResult | null,
  formData: FormData,
): Promise<OnboardingResult> {
  return submitOnboarding(organizationId, formData);
}
