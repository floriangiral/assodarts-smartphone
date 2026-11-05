import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveDomain } from "@/lib/routing/resolveDomain";
import { resolveHost } from "@/lib/routing/resolveHost";
import { getPublishedClubById } from "./data";

export async function getCustomDomainClub(host: string) {
  const requestHeaders = await headers();
  const actual = resolveHost(
    requestHeaders.get("x-forwarded-host"),
    requestHeaders.get("host"),
    process.env.ROOT_DOMAIN || "localhost",
    process.env.APPHOSTING_DEFAULT_HOST,
  );
  if (actual.kind !== "custom" || actual.host !== host) notFound();

  let clubId: string | null;
  try {
    clubId = await resolveDomain(host);
  } catch {
    notFound();
  }
  if (!clubId) notFound();
  return getPublishedClubById(clubId);
}