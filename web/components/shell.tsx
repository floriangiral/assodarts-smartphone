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
};

export function Shell({
  children,
  club,
}: {
  children: ReactNode;
  club?: ClubIdentity;
}) {
  const localClubQuery =
    club && process.env.ROOT_DOMAIN === "localhost"
      ? `?club=${encodeURIComponent(club.slug)}`
      : "";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link
            aria-label={club ? `${club.name}, accueil` : messages.title}
            className="focus-ring flex shrink-0 items-center gap-3 rounded-sm"
            href={club ? `/${localClubQuery}` : "/"}
          >
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
            <span className="text-[15px] font-bold">
              {club?.name ?? messages.title}
            </span>
          </Link>

          {club ? (
            <nav aria-label="Navigation du club" className="flex items-center gap-1 sm:gap-3">
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
              <a
                className="focus-ring hidden rounded-sm text-sm font-semibold text-muted transition hover:text-ink sm:inline-flex"
                href="#fonctionnalites"
              >
                L’application
              </a>
              <Link
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-4 text-sm font-semibold text-white transition hover:bg-navy-deep"
                href="/admin"
              >
                Espace responsable
                <ChevronRight aria-hidden="true" size={16} />
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Assodarts. Le jeu, côté club.</p>
          {club ? (
            <span>{club.city ?? ""}</span>
          ) : (
            <p>Conçu pour les clubs qui font vivre les fléchettes.</p>
          )}
        </div>
      </footer>
    </div>
  );
}
