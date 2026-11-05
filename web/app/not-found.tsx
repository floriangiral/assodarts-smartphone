import Link from "next/link";
import { messages } from "../lib/messages";
export default function NotFound() { return <main><h1>{messages.notFound}</h1><Link href="/">{messages.home}</Link></main>; }
