-- Row-Level Security for tenant isolation (defense in depth behind tenantPrisma).
--
-- Apply after `prisma migrate deploy`:
--     psql "$DATABASE_URL" -f packages/db/sql/rls.sql
-- then set DB_RLS=on for the app + worker.
--
-- Policies key off the GUC `app.current_org_id`, which `withOrgContext` /
-- `tenantPrisma` set per transaction. `current_setting(..., true)` returns NULL
-- when unset; NULL = <anything> is NULL (false), so an unscoped connection sees
-- no tenant rows. FORCE makes the policies apply even to the table owner.

DO $$
DECLARE
  t text;
  org_tables text[] := ARRAY[
    'Organization','OrganizationKyc','Membership','CustomDomain','Subscription',
    'Campaign','Page','Donor','Donation','RecurringPlan','Payout','KycDocument',
    'Export','OutboundWebhook','WebhookDelivery','AuditLog'
  ];
BEGIN
  FOREACH t IN ARRAY org_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  END LOOP;
END $$;

-- Organization: match by id
CREATE POLICY tenant_isolation ON "Organization"
  USING (id = current_setting('app.current_org_id', true))
  WITH CHECK (id = current_setting('app.current_org_id', true));

-- OrganizationKyc: PK is organizationId
CREATE POLICY tenant_isolation ON "OrganizationKyc"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

-- All other tenant tables: match by organizationId column
DO $$
DECLARE
  t text;
  by_org_id text[] := ARRAY[
    'Membership','CustomDomain','Subscription','Campaign','Page','Donor','Donation',
    'RecurringPlan','Payout','KycDocument','Export','OutboundWebhook','WebhookDelivery','AuditLog'
  ];
BEGIN
  FOREACH t IN ARRAY by_org_id LOOP
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING ("organizationId" = current_setting('app.current_org_id', true))
        WITH CHECK ("organizationId" = current_setting('app.current_org_id', true))
    $f$, t);
  END LOOP;
END $$;

-- AuditLog.organizationId is nullable (platform-level events) — allow those too.
DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
CREATE POLICY tenant_isolation ON "AuditLog"
  USING ("organizationId" IS NULL OR "organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" IS NULL OR "organizationId" = current_setting('app.current_org_id', true));

-- Indirect tables: isolate via their parent.
ALTER TABLE "PageVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PageVersion" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PageVersion";
CREATE POLICY tenant_isolation ON "PageVersion"
  USING (EXISTS (
    SELECT 1 FROM "Page" p
    WHERE p.id = "PageVersion"."pageId"
      AND p."organizationId" = current_setting('app.current_org_id', true)
  ));

ALTER TABLE "DonationOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DonationOption" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DonationOption";
CREATE POLICY tenant_isolation ON "DonationOption"
  USING (EXISTS (
    SELECT 1 FROM "Campaign" c
    WHERE c.id = "DonationOption"."campaignId"
      AND c."organizationId" = current_setting('app.current_org_id', true)
  ));

ALTER TABLE "DonorTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DonorTag" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DonorTag";
CREATE POLICY tenant_isolation ON "DonorTag"
  USING (EXISTS (
    SELECT 1 FROM "Donor" d
    WHERE d.id = "DonorTag"."donorId"
      AND d."organizationId" = current_setting('app.current_org_id', true)
  ));
