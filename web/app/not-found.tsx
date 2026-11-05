import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { messages } from "@/lib/messages";
export default function NotFound() { return <Shell><h1 className="text-3xl font-bold">{messages.notFound}</h1><p className="mt-4 opacity-70">{messages.notFoundDescription}</p><Button asChild className="mt-8"><Link href="/">{messages.home}</Link></Button></Shell>; }
