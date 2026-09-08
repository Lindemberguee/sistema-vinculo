import { redirect } from "next/navigation";

export default async function OrgsFallbackPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  redirect(`/panel/orgs/${path.map(encodeURIComponent).join("/")}`);
}
