import { Shell } from "@/components/shell";
import { messages } from "@/lib/messages";
export default function Admin() { return <Shell><section className="max-w-xl rounded-2xl border border-border bg-surface p-8 sm:p-12"><p className="mb-3 text-sm font-semibold uppercase tracking-widest text-orange">{messages.title}</p><h1 className="text-3xl font-bold">{messages.admin}</h1><p className="mt-4 opacity-70">{messages.adminPlaceholder}</p></section></Shell>; }
