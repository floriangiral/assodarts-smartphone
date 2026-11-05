import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { messages } from "@/lib/messages";
export default function NotFound() {
	return (
		<Shell>
			<section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
				<p className="text-xs font-bold uppercase text-orange">
					404
				</p>
				<h1 className="font-display mt-4 text-4xl sm:text-6xl">
					{messages.notFound}
				</h1>
				<p className="mt-4 max-w-lg leading-7 text-muted">
					{messages.notFoundDescription}
				</p>
				<Button asChild className="mt-8">
					<Link href="/">{messages.home}</Link>
				</Button>
			</section>
		</Shell>
	);
}
