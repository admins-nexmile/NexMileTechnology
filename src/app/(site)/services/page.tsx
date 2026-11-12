import { Check } from "lucide-react";
import { CtaSection } from "@/components/sections/CtaSection";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { services } from "@/content/services";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Services",
  description:
    "IT consulting, software and application development, Master Data Management (MDM), cloud and infrastructure, cybersecurity, digital transformation and managed services from NexmileTechnology.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <PageHero
        current="Services"
        eyebrow="Our Services"
        title="Technology services that move your business forward"
        description="From advice and development to data, security and ongoing support, our services cover the full lifecycle of the technology your organisation relies on."
      >
        <ButtonLink href="/contact" size="lg" arrow>
          Discuss Your Requirements
        </ButtonLink>
      </PageHero>

      <section aria-label="Service list" className="py-20 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-12">
          {/* In-page navigation */}
          <nav aria-label="Services on this page" className="hidden lg:col-span-4 lg:block xl:col-span-3">
            <div className="sticky top-28 rounded-2xl border border-line bg-surface p-5">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-subtle">On this page</p>
              <ul className="mt-3 space-y-0.5">
                {services.map(({ id, title, icon: Icon }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink/80 transition-colors hover:bg-white hover:text-brand-600"
                    >
                      <Icon className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                      {title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="space-y-8 lg:col-span-8 xl:col-span-9">
            {services.map(({ id, title, icon: Icon, summary, capabilities, benefits }) => (
              <Reveal key={id}>
                <article
                  id={id}
                  aria-labelledby={`${id}-title`}
                  className="scroll-mt-28 overflow-hidden rounded-3xl border border-line bg-white shadow-card"
                >
                  <div className="flex flex-col gap-6 border-b border-line p-7 sm:flex-row sm:items-start sm:p-10">
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-800 to-brand-600 text-cyan-300 shadow-[0_10px_24px_-10px_rgb(0_40_120/0.7)]">
                      <Icon className="size-7" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div>
                      <h2 id={`${id}-title`} className="text-2xl font-semibold text-navy-900 sm:text-[1.75rem]">
                        {title}
                      </h2>
                      <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">{summary}</p>
                    </div>
                  </div>
                  <div className="grid gap-8 bg-surface/60 p-7 sm:grid-cols-2 sm:p-10">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">What we cover</h3>
                      <ul className="mt-4 space-y-3">
                        {capabilities.map((item) => (
                          <li key={item} className="flex items-start gap-3 text-sm text-navy-900">
                            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-sky-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">Business benefits</h3>
                      <ul className="mt-4 space-y-3">
                        {benefits.map((item) => (
                          <li key={item} className="flex items-start gap-3 text-sm text-navy-900">
                            <Check className="mt-0.5 size-4 shrink-0 text-brand-600" strokeWidth={2.5} aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <ProcessSteps />

      <CtaSection
        title="Let's discuss what you need."
        description="Tell us about your goals and challenges, and we will help you identify the services that fit."
        secondary={{ label: "View Solutions", href: "/solutions" }}
      />
    </>
  );
}
