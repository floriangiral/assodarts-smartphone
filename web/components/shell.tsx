import type { ReactNode } from "react";
import { messages } from "@/lib/messages";
export function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen"><header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6"><span className="flex items-center gap-3 font-bold tracking-tight"><span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-navy text-orange">●</span>{messages.title}</span><span className="text-sm opacity-70">{messages.preview}</span></header><main className="mx-auto max-w-6xl px-6 py-14 sm:py-24">{children}</main></div>;
}
