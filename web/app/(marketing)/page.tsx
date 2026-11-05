import { Shell } from "@/components/shell";
import Image from "next/image";
import Link from "next/link";
import { messages } from "@/lib/messages";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  CircleUserRound,
  ClipboardList,
  ShieldCheck,
  Target,
  UsersRound,
} from "lucide-react";

// DECISION: provisional marketing copy, awaiting product validation.
export default function Home() {
  const copy = messages.marketingPage;
  const featureIcons = [UsersRound, CalendarDays, CircleUserRound];

  return (
    <Shell>
      <section className="relative isolate overflow-hidden border-b border-border bg-background">
        <div className="pointer-events-none absolute -right-36 -top-32 -z-10 size-[34rem] rounded-full border-[1px] border-green/15" />
        <div className="pointer-events-none absolute -right-8 -top-4 -z-10 size-[25rem] rounded-full border-[1px] border-orange/20" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[1fr_0.92fr] lg:gap-16">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-[11px] font-bold uppercase text-muted">
              <span className="size-2 rounded-full bg-green" />
              {copy.eyebrow}
            </div>
            <h1 className="font-display max-w-xl text-5xl leading-[0.99] text-ink sm:text-6xl xl:text-7xl">
              {copy.headlineLead} <span className="text-ink">{copy.headlineAccent}</span>
              {copy.headlineEnd}
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-muted">
              {copy.description}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                className="focus-ring inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-navy px-6 text-sm font-bold text-white transition hover:bg-navy-deep"
                href="/admin"
              >
                {copy.adminLink}
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <a
                className="focus-ring inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-border bg-surface px-6 text-sm font-bold text-ink transition hover:bg-soft"
                href="#fonctionnalites"
              >
                {copy.featuresLink}
                <ArrowDown aria-hidden="true" size={16} />
              </a>
            </div>
            <p className="mt-5 text-xs leading-5 text-muted">
              {copy.accessNote}
            </p>
          </div>

          <div aria-label={copy.previewLabel} className="relative mx-auto w-full max-w-[34rem]">
            <div className="absolute -left-4 top-12 z-10 hidden items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xl sm:flex">
              <span className="grid size-10 place-items-center rounded-lg bg-green-soft text-green">
                <UsersRound aria-hidden="true" size={19} />
              </span>
              <span>
                <span className="block text-xs text-muted">{copy.clubLife}</span>
                <span className="block text-sm font-bold">{copy.together}</span>
              </span>
            </div>
            <div className="overflow-hidden rounded-[1.4rem] border border-border bg-[#e6e9e4] p-3 shadow-[0_24px_70px_-35px_rgba(23,35,58,0.28)] sm:p-4">
              <div className="rounded-[1rem] bg-[#f6f7f4] p-4 text-[#17233a] sm:p-6">
                <div className="flex items-center justify-between gap-4 border-b border-[#e1e6e0] pb-4">
                  <div className="flex items-center gap-3">
                    <Image
                      alt=""
                      aria-hidden="true"
                      className="size-10 rounded-xl"
                      height={40}
                      src="/assodarts-mark.png"
                      unoptimized
                      width={40}
                    />
                    <div>
                      <p className="text-sm font-bold">Mon club</p>
                      <p className="text-xs text-[#66716a]">{copy.clubSpace}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#e3f2ed] px-3 py-1.5 text-[10px] font-bold uppercase text-[#0e8a6d]">
                    {copy.season}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-5">
                  <div className="rounded-xl bg-white p-4">
                    <p className="text-xs text-[#66716a]">{copy.members}</p>
                    <div className="mt-3 flex items-end justify-between">
                      <span className="font-display text-3xl">{copy.memberSnapshot}</span>
                      <UsersRound aria-hidden="true" className="text-[#0e8a6d]" size={19} />
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-4">
                    <p className="text-xs text-[#66716a]">{copy.nextEvent}</p>
                    <div className="mt-3 flex items-end justify-between">
                      <span className="font-display text-3xl">{copy.calendarSnapshot}</span>
                      <CalendarDays aria-hidden="true" className="text-[#f5990b]" size={19} />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">{copy.onTheBill}</p>
                    <span className="text-xs font-semibold text-[#1c3660]">{messages.navigation.agenda}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-3 border-t border-[#e1e6e0] pt-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#fdf0df] text-[#b45309]">
                      <Target aria-hidden="true" size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{copy.eventExample}</p>
                      <p className="mt-1 text-xs text-[#66716a]">{copy.eventTeaser}</p>
                    </div>
                    <ArrowRight aria-hidden="true" className="text-[#66716a]" size={16} />
                  </div>
                  <div className="mt-4 flex items-center gap-3 border-t border-[#e1e6e0] pt-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#e8edf5] text-[#1c3660]">
                      <ClipboardList aria-hidden="true" size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{copy.seasonOrganization}</p>
                      <p className="mt-1 text-xs text-[#66716a]">{copy.toolsSummary}</p>
                    </div>
                    <Check aria-hidden="true" className="text-[#0e8a6d]" size={17} />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 right-5 hidden items-center gap-2 rounded-full bg-orange px-4 py-3 text-xs font-bold text-[#132743] shadow-lg sm:flex">
              <ShieldCheck aria-hidden="true" size={16} />
              {copy.clubFocused}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28" id="fonctionnalites">
        <div className="grid gap-8 border-b border-border pb-12 md:grid-cols-[0.8fr_1.2fr] md:items-end">
          <p className="text-xs font-bold uppercase text-green">
            {copy.featuresEyebrow}
          </p>
          <div>
            <h2 className="font-display max-w-2xl text-4xl leading-tight sm:text-5xl">
              {copy.featuresTitle}
            </h2>
            <p className="mt-5 max-w-2xl leading-7 text-muted">
              {copy.featuresDescription}
            </p>
          </div>
        </div>
        <div className="grid gap-px bg-border md:grid-cols-3">
          {copy.featureCards.map(({ title, description }, index) => {
            const Icon = featureIcons[index];
            const tone = [
              "bg-green-soft text-green",
              "bg-[#fdf0df] text-[#a75b08]",
              "bg-soft text-navy",
            ][index];
            const number = `0${index + 1}`;

            return (
            <article className="bg-background p-6 sm:p-8" key={number}>
              <div className="flex items-center justify-between">
                <span className={`grid size-11 place-items-center rounded-xl ${tone}`}>
                  <Icon aria-hidden="true" size={21} />
                </span>
                <span className="font-display text-2xl text-muted/60">{number}</span>
              </div>
              <h3 className="mt-8 text-lg font-bold">{title}</h3>
              <p className="mt-3 max-w-xs text-sm leading-6 text-muted">{description}</p>
            </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-border bg-green-soft/50" id="clubs">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 sm:py-20 md:grid-cols-[1fr_auto] md:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase text-green">
              {copy.mobileEyebrow}
            </p>
            <h2 className="font-display mt-4 text-3xl leading-tight sm:text-4xl">
              {copy.mobileTitle}
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-muted">
              {copy.mobileDescription}
            </p>
          </div>
          <Link
            className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-green/30 bg-surface px-5 text-sm font-bold text-green transition hover:bg-green-soft"
            href="/admin"
          >
            {messages.navigation.admin} <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </section>

      <p className="mx-auto max-w-7xl px-5 py-6 text-xs leading-5 text-muted sm:px-8">
        {copy.provisional}
      </p>
    </Shell>
  );
}
