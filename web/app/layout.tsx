import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { messages } from "@/lib/messages";
export const metadata: Metadata = {
  title: messages.title,
  description: messages.marketing,
  robots: process.env.ROOT_DOMAIN?.startsWith("staging.")
    ? { index: false, follow: false }
    : undefined,
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
