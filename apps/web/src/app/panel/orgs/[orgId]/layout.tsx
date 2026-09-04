import type { ReactNode } from "react";
import Link from "next/link";
import { prisma, getOrgLimits, moduleAccessFor } from "@donation/db";
import { requireUserPage, requireOrgAccessPage } from "@/server/auth-helpers";
import { PanelChrome } from "@/components/PanelChrome";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const user = await requireUserPage();
  const { membership } = await requireOrgAccessPage(orgId, "VIEWER");

  const [limits, sub] = await Promise.all([
    getOrgLimits(orgId),
    prisma.subscription.findUnique({
      where: { organizationId: orgId },
      select: { status: true, currentPeriodEnd: true },
    }),
  ]);

  const billingWarn =
    sub?.status === "PAST_DUE" ? (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/30 bg-danger-bg px-4 py-2.5 text-sm text-danger">
        <span>Mensalidade vencida — regularize para não suspender a organização.</span>
        <Link href={`/orgs/${orgId}/billing`} className="font-medium underline">
          Ver plano e cobrança
        </Link>
      </div>
    ) : null;

  return (
    <PanelChrome
      orgId={orgId}
      current={membership}
      memberships={user.memberships}
      userName={user.name ?? ""}
      moduleAccess={moduleAccessFor(limits)}
      banner={
        <>
          {user.verified ? null : <VerifyEmailBanner />}
          {billingWarn}
        </>
      }
    >
      {children}
    </PanelChrome>
  );
}
