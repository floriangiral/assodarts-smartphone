import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { messages } from "@/lib/messages";
export const metadata: Metadata = { title: messages.title, description: messages.marketing };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
