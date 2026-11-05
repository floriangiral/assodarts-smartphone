import { clubSlugSchema } from "@assodarts/shared";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { messages } from "@/lib/messages";
export default async function Club({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!clubSlugSchema.safeParse(slug).success) notFound();
  return <Shell><section className="rounded-2xl border border-border bg-surface p-8 sm:p-12"><p className="mb-3 text-sm font-semibold uppercase tracking-widest text-orange">{messages.club}</p><h1 className="text-3xl font-bold sm:text-4xl">{slug}</h1><p className="mt-4 opacity-70">{messages.clubPlaceholder}</p></section></Shell>;
}
