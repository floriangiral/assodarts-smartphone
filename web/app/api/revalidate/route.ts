import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { clubSlugSchema } from "@assodarts/shared";
import { z } from "zod";

export const runtime = "nodejs";

const payloadSchema = z.object({
  clubId: z.uuid(),
  slug: clubSlugSchema.optional(),
  eventIds: z.array(z.string().min(1).max(128)).max(100).optional(),
});

function hasValidSecret(header: string | null, expected: string) {
  const prefix = "Bearer ";
  if (!header?.startsWith(prefix)) return false;
  const provided = Buffer.from(header.slice(prefix.length));
  const secret = Buffer.from(expected);
  return provided.length === secret.length && timingSafeEqual(provided, secret);
}

export async function POST(request: Request) {
  const secret = process.env.WEB_REVALIDATION_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "revalidation_unavailable" }, { status: 503 });
  }
  if (!hasValidSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  revalidateTag("club-slug", "max");
  revalidateTag(`public-events-${parsed.data.clubId}`, "max");
  for (const eventId of parsed.data.eventIds ?? []) {
    revalidateTag(`public-event-${eventId}`, "max");
  }

  return NextResponse.json({ revalidated: true });
}