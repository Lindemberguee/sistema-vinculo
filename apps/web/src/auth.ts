import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@donation/db";
import type { OrgRole } from "@donation/shared";
import { env } from "@/env";
import { bucketKey, ipFromRequest, rateLimit, RL } from "@/server/rate-limit";

export interface SessionMembership {
  organizationId: string;
  slug: string;
  displayName: string;
  role: OrgRole;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Whether the account's e-mail has been confirmed. */
      verified: boolean;
      memberships: SessionMembership[];
    } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

async function loadMemberships(userId: string): Promise<SessionMembership[]> {
  const rows = await prisma.membership.findMany({
    where: { userId },
    select: { role: true, organization: { select: { id: true, slug: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((m) => ({
    organizationId: m.organization.id,
    slug: m.organization.slug,
    displayName: m.organization.displayName,
    role: m.role as OrgRole,
  }));
}

const providers: Provider[] = [
  Credentials({
    credentials: { email: {}, password: {} },
    authorize: async (raw, request) => {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;

      // Throttle by IP — a tripped limit fails like a wrong password.
      const ip = request instanceof Request ? ipFromRequest(request) : "unknown";
      const [limit, windowSec] = RL.login;
      const gate = await rateLimit(bucketKey("login", ip), limit, windowSec);
      if (!gate.ok) return null;

      const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
      if (!user?.passwordHash) return null;
      const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!ok) return null;
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

// Cap how long a stale JWT can carry outdated memberships/verification on the
// display surfaces (org switcher, sidebar). Org-scoped *authorization* is
// re-checked against the DB per request in `requireOrgAccess`, so this is
// defence-in-depth, not the primary guard.
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const MEMBERSHIP_TTL_MS = 15 * 60 * 1000; // re-read from DB at most every 15 min

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  secret: env.NEXTAUTH_SECRET,
  trustHost: true,
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    jwt: async ({ token, user, trigger }) => {
      if (user?.id) token.uid = user.id;
      const lastSync = (token.membershipsSyncedAt as number | undefined) ?? 0;
      const stale = Date.now() - lastSync > MEMBERSHIP_TTL_MS;
      // Refresh on sign-in, on explicit session update, or when the cached copy
      // has aged out.
      if ((user?.id || trigger === "update" || stale) && token.uid) {
        const uid = token.uid as string;
        const [memberships, row] = await Promise.all([
          loadMemberships(uid),
          prisma.user.findUnique({
            where: { id: uid },
            select: { emailVerified: true, name: true, email: true, image: true },
          }),
        ]);
        token.memberships = memberships;
        token.verified = Boolean(row?.emailVerified);
        // Keep the display identity fresh too, so "Minha conta" edits show up
        // without a re-login.
        if (row) {
          token.name = row.name;
          token.email = row.email;
          token.picture = row.image;
        }
        token.membershipsSyncedAt = Date.now();
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = (token.uid as string) ?? "";
      session.user.verified = Boolean(token.verified);
      session.user.memberships = (token.memberships as SessionMembership[] | undefined) ?? [];
      if (token.name !== undefined) session.user.name = token.name;
      if (token.email) session.user.email = token.email;
      if (token.picture !== undefined) session.user.image = token.picture as string | null | undefined;
      return session;
    },
  },
});
