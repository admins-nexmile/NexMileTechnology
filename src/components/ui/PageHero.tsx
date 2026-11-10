import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

type PageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  /** Name shown in the breadcrumb */
  current: string;
  children?: ReactNode;
};

/** Compact dark header used at the top of every inner page. */
export function PageHero({ eyebrow, title, description, current, children }: PageHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-navy-950 text-white">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="bg-grid-dark absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_25%,transparent_70%)]" />
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-600/30 blur-[120px]" />
        <div className="absolute -right-24 top-10 h-[22rem] w-[22rem] rounded-full bg-sky-500/15 blur-[120px]" />
        <svg
          viewBox="0 0 600 300"
          fill="none"
          className="absolute -right-24 top-1/2 hidden w-[42rem] -translate-y-1/2 text-cyan-300/20 lg:block"
        >
          <ellipse cx="300" cy="150" rx="280" ry="110" stroke="currentColor" transform="rotate(-18 300 150)" />
          <ellipse cx="300" cy="150" rx="200" ry="70" stroke="currentColor" strokeDasharray="3 8" transform="rotate(-18 300 150)" />
          <circle cx="545" cy="70" r="5" fill="currentColor" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      </div>

      <Container className="py-16 sm:py-20 lg:py-24">
        <nav aria-label="Breadcrumb" className="animate-fade-up">
          <ol className="flex items-center gap-1.5 text-sm text-white/55">
            <li>
              <Link href="/" className="transition-colors hover:text-cyan-300">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="size-3.5" />
            </li>
            <li aria-current="page" className="text-white/85">
              {current}
            </li>
          </ol>
        </nav>

        <div className="max-w-3xl">
          <p
            className="animate-fade-up mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"
            style={{ animationDelay: "60ms" }}
          >
            {eyebrow}
          </p>
          <h1
            className="animate-fade-up mt-4 text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-[3.5rem]"
            style={{ animationDelay: "120ms" }}
          >
            {title}
          </h1>
          <p
            className="animate-fade-up mt-6 text-lg leading-relaxed text-white/75 sm:text-xl"
            style={{ animationDelay: "180ms" }}
          >
            {description}
          </p>
          {children && (
            <div className="animate-fade-up mt-9" style={{ animationDelay: "240ms" }}>
              {children}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
