import { env } from "@/env";

const BASE = env.APP_BASE_DOMAIN.split(":")[0]!.toLowerCase();

/** The CNAME target tenants point their custom domain at. */
export const CNAME_TARGET = `cname.${BASE}`;
export const PLATFORM_BASE_DOMAIN = BASE;
