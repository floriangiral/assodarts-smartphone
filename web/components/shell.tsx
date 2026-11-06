/* eslint-disable @next/next/no-html-link-for-pages -- /admin redirects to another host and needs a document navigation. */
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ChevronRight } from "lucide-react";
import { messages } from "@/lib/messages";

type ClubIdentity = {
  name: string;
  slug: string;
  city?: string;
  contactEmail?: string;
  logoUrl?: string;
};

export function Shell({
  children,
  club,
  customDomain = false,
  featuresAvailable = false,
}: Readonly<{
  children: ReactNode;
  club?: ClubIdentity;
  customDomain?: boolean;
  featuresAvailable?: boolean;
}>) {
  const localClubQuery =
    club && !customDomain && process.env.ROOT_DOMAIN === "localhost"
      ? `?club=${encodeURIComponent(club.slug)}`
      : "";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-5 sm:gap-6 sm:px-8">
          <Link
            aria-label={club ? `${club.name}, accueil` : messages.title}
            className="focus-ring flex min-w-0 items-center gap-2 rounded-sm sm:gap-3"
            href={club ? `/${localClubQuery}` : "/"}
          >
            {club?.logoUrl ? (
              <span
                aria-label={`${messages.clubPage.logoLabel} ${club.name}`}
                className="size-10 shrink-0 rounded-lg bg-cover bg-center"
                role="img"
                style={{ backgroundImage: `url("${club.logoUrl}")` }}
              />
            ) : (
              <Image
                alt=""
                aria-hidden="true"
                className="size-10 rounded-xl"
                height={40}
                priority
                src="/assodarts-mark.png"
                unoptimized
                width={40}
              />
            )}
            <span className="truncate text-[15px] font-bold">
              {club?.name ?? messages.title}
            </span>
          </Link>

          {club ? (
            <nav aria-label="Navigation du club" className="flex shrink-0 items-center gap-1 sm:gap-3">
              <Link
                className="focus-ring hidden rounded-sm px-3 py-2 text-sm font-semibold text-muted transition hover:text-ink sm:flex"
                href={`/${localClubQuery}`}
              >
                Le club
              </Link>
              <Link
                className="focus-ring flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold text-muted transition hover:text-ink"
                href={`/agenda${localClubQuery}`}
              >
                <CalendarDays aria-hidden="true" size={16} />
                <span>Agenda</span>
              </Link>
              <a className="focus-ring inline-flex min-h-10 items-center rounded-full bg-navy px-3 text-xs font-bold text-white transition hover:bg-navy-deep sm:px-4 sm:text-sm" href="/admin">Espace club</a>
              {club.contactEmail && (
                <a
                  className="focus-ring hidden items-center gap-1 rounded-sm px-3 py-2 text-sm font-semibold text-navy transition hover:text-ink md:flex"
                  href={`mailto:${club.contactEmail}`}
                >
                  Contacter <ArrowUpRight aria-hidden="true" size={15} />
                </a>
              )}
            </nav>
          ) : (
            <nav aria-label="Navigation principale" className="flex items-center gap-3 sm:gap-7">
              {featuresAvailable && <a
                className="focus-ring hidden rounded-sm text-sm font-semibold text-muted transition hover:text-ink sm:inline-flex"
                href="#fonctionnalites"
              >
                L’application
              </a>}
              <a
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-4 text-sm font-semibold text-white transition hover:bg-navy-deep"
                href="/admin"
              >
                Se connecter
                <ChevronRight aria-hidden="true" size={16} />
              </a>
            </nav>
          )}
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Assodarts</p>
          {club ? (
            <div className="flex flex-wrap items-center gap-4"><span>{club.city ?? ""}</span><a className="focus-ring font-semibold text-navy hover:underline" href="/retour-accueil">Site Assodarts <ArrowUpRight aria-hidden="true" className="inline" size={14} /></a></div>
          ) : (
            null
          )}
        </div>
      </footer>
    </div>
  );
}
