import { Shell } from "@/components/shell";
import { messages } from "@/lib/messages";
export default function Home() { return <Shell><div className="max-w-3xl"><p className="mb-5 text-sm font-bold uppercase tracking-widest text-orange">{messages.title}</p><h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{messages.tagline}</h1><p className="mt-6 max-w-xl text-lg leading-relaxed opacity-75">{messages.marketing}</p><div aria-hidden="true" className="mt-12 h-1 w-20 rounded-full bg-orange" /></div></Shell>; }
