import { ArrowRight } from "lucide-react";
import { CtaSection } from "@/components/sections/CtaSection";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { industries } from "@/content/industries";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Industries",
  description:
    "Technology services and solutions for information technology, healthcare, education, banking and financial services, retail and e-commerce, manufacturing and professional services.",
  path: "/industries",
});

export default function IndustriesPage() {
  return (
    <>
      <PageHero
        current="Industries"
        eyebrow="Industries We Serve"
        title="Technology shaped around your sector"
        description="Every industry has its own priorities, regulations and ways of working. We take the time to understand them so that the technology we recommend fits your context."
      />

      <section aria-label="Industry list" className="py-20 sm:py-28">
        <Container>
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {industries.map(({ id, title, icon: Icon, description, focus }, index) => (
              <Reveal key={id} as="li" delay={(index % 3) * 0.08}>
                <article
                  id={id}
                  aria-labelledby={`${id}-title`}
                  className="group relative flex h-full scroll-mt-28 flex-col overflow-hidden rounded-3xl border border-line bg-white p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-navy-800 via-brand-600 to-cyan-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                    <Icon className="size-7" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h2 id={`${id}-title`} className="mt-7 text-xl font-semibold text-navy-900">
                    {title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
                  <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
                    Where we can help
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {focus.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-navy-900">
                        <ArrowRight className="mt-0.5 size-4 shrink-0 text-sky-500" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}

            <Reveal as="li" delay={0.08} className="lg:col-span-2">
              <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-brand-600 p-8 text-white">
                <div aria-hidden="true" className="bg-grid-dark absolute inset-0 opacity-60" />
                <div className="relative">
                  <h2 className="text-xl font-semibold">Your industry not listed?</h2>
                  <p className="mt-3 text-sm leading-relaxed text-white/75">
                    Our services apply across many sectors. Tell us about your organisation and
                    what you are trying to achieve.
                  </p>
                </div>
                <div className="relative mt-8">
                  <ButtonLink href="/contact" variant="outline-light" arrow>
                    Get in Touch
                  </ButtonLink>
                </div>
              </div>
            </Reveal>
          </ul>
        </Container>
      </section>

      <section aria-labelledby="approach-title" className="bg-surface py-20 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
          <Reveal>
            <SectionHeading
              id="approach-title"
              eyebrow="Our Approach"
              title="Understanding your sector comes first"
            />
          </Reveal>
          <Reveal delay={0.1} className="space-y-5 text-base leading-relaxed text-muted sm:text-lg">
            <p>
              Before recommending technology, we take time to understand the regulations, data
              sensitivities, operating models and users that are specific to your industry.
            </p>
            <p>
              That understanding shapes everything from how we design systems and manage data to how
              we approach security, support and training.
            </p>
          </Reveal>
        </Container>
      </section>

      <CtaSection
        title="Let's talk about your sector."
        description="Share your organisation's priorities and challenges, and we will explore how technology can help."
        secondary={{ label: "Explore Our Services", href: "/services" }}
      />
    </>
  );
}
