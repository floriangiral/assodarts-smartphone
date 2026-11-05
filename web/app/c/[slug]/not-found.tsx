import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { messages } from "@/lib/messages";
export default function ClubNotFound() { return <Shell><h1 className="text-3xl font-bold">{messages.clubNotFound}</h1><Button asChild className="mt-8"><Link href="/">{messages.home}</Link></Button></Shell>; }
