import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { messages } from "@/lib/messages";
export default function ClubNotFound() {
	return (
		<Shell>
			<section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
				<p className="text-xs font-bold uppercase text-orange">
					404 · Assodarts
				</p>
				<h1 className="font-display mt-4 max-w-2xl text-4xl leading-tight sm:text-6xl">
					{messages.clubNotFound}
				</h1>
				<Button asChild className="mt-8">
					<Link href="/">{messages.home}</Link>
				</Button>
			</section>
		</Shell>
	);
}
