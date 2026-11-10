import { Mail } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { siteConfig } from "@/config/site";

type CtaAction = { label: string; href: string };

type CtaSectionProps = {
  title?: string;
  description?: string;
  primary?: CtaAction;
  secondary?: CtaAction;
  /** Drop the top padding when the previous section already provides spacing */
  flushTop?: boolean;
};

/** Closing call-to-action panel used at the bottom of every page. */
export function CtaSection({
  title = "Let's Build What's Next.",
  description = "Whether you are planning a new initiative, modernising existing systems or developing your team's skills, we would be glad to hear from you.",
  primary = { label: "Get in Touch", href: "/contact" },
  secondary = { label: "Explore Our Services", href: "/services" },
  flushTop = false,
}: CtaSectionProps) {
  return (
    <section aria-labelledby="cta-title" className={flushTop ? "pb-20 sm:pb-28" : "py-20 sm:py-28"}>
      <Container>
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy-900 via-navy-800 to-brand-600 px-6 py-16 text-center text-white sm:px-12 sm:py-20 lg:py-24">
            <div aria-hidden="true" className="absolute inset-0 -z-10">
              <div className="bg-grid-dark absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
              <div className="absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-cyan-400/25 blur-3xl" />
              <svg
                viewBox="0 0 800 200"
                className="absolute inset-x-0 bottom-0 w-full text-cyan-300/30"
                fill="none"
                preserveAspectRatio="none"
              >
                <path d="M0 170 C 200 90, 600 90, 800 170" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              {siteConfig.brandStatement}
            </p>
            <h2 id="cta-title" className="mx-auto mt-5 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              {title}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              {description}
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
              <ButtonLink href={primary.href} size="lg" variant="outline-light" arrow>
                {primary.label}
              </ButtonLink>
              <ButtonLink href={secondary.href} size="lg" variant="ghost-dark">
                {secondary.label}
              </ButtonLink>
            </div>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="mt-8 inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-cyan-300"
            >
              <Mail className="size-4" aria-hidden="true" />
              {siteConfig.contact.email}
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
