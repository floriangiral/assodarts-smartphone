import "server-only";
import { unstable_cache } from "next/cache";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { serverApp } from "@/lib/firebase/server";

// Domain mappings are server-managed; the document ID is the normalized host.
const domainSchema = z.object({ clubId: z.uuid() });
const validHost = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const resolveDomain = unstable_cache(async (host: string): Promise<string | null> => {
  if (!validHost.test(host)) return null;
  const snapshot = await getFirestore(serverApp()).collection("domains").doc(host).get();
  const parsed = domainSchema.safeParse(snapshot.data());
  return snapshot.exists && parsed.success ? parsed.data.clubId : null;
}, ["custom-domain"], { revalidate: 60 });
