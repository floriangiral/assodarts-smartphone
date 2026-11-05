import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { messages } from "@/lib/messages";
import { resolveHost } from "@/lib/routing/resolveHost";
import { resolveDomain } from "@/lib/routing/resolveDomain";

export default async function CustomDomain({ params }: { params: Promise<{ host: string; rest?: string[] }> }) {
  const { host, rest } = await params;
  const requestHeaders = await headers();
  const actual = resolveHost(requestHeaders.get("x-forwarded-host"), requestHeaders.get("host"), process.env.ROOT_DOMAIN || "localhost");
  if (actual.kind !== "custom" || actual.host !== host || rest?.length) notFound();
  let clubId: string | null;
  try { clubId = await resolveDomain(host); } catch { notFound(); }
  if (!clubId) notFound();
  return <Shell><section className="rounded-2xl border border-border bg-surface p-8 sm:p-12"><h1 className="text-3xl font-bold">{messages.club}</h1><p className="mt-4 opacity-70">{messages.clubPlaceholder}</p></section></Shell>;
}
