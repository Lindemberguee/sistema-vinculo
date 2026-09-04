/** @type {import('next').NextConfig} */
// Env comes from the repo-root `.env`, injected by `dotenv-cli` in the npm
// scripts (see package.json). Next's own loader would only see `apps/web/.env`.
const nextConfig = {
  reactStrictMode: true,
  // packages/* are plain TS source — let Next transpile them.
  transpilePackages: [
    "@donation/blocks",
    "@donation/db",
    "@donation/emails",
    "@donation/payments",
    "@donation/shared",
  ],
  // Node-only libs must stay server-side (Next 15: top-level, no longer experimental).
  serverExternalPackages: ["@prisma/client", "bullmq", "ioredis", "stripe", "qrcode"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
