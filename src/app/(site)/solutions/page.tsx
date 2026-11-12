import Link from "next/link";
import { Check } from "lucide-react";
import { CtaSection } from "@/components/sections/CtaSection";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { getService } from "@/content/services";
import { solutions } from "@/content/solutions";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Solutions",
  description:
    "Enterprise technology, application and software, device and endpoint management, cloud, business automation and digital workplace solutions from NexmileTechnology.",
  path: "/solutions",
});

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        current="Solutions"
        eyebrow="Technology Solutions"
        title="Focused solutions for real business challenges"
        description="Our solutions combine services, technology and expertise to address the challenges organisations commonly face, from fragmented systems to manual processes."
      >
        <ButtonLink href="/contact" size="lg" arrow>
          Talk to Us About a Solution
        </ButtonLink>
      </PageHero>

      <section aria-label="Solution list" className="py-20 sm:py-28">
        <Container>
          <ul className="grid gap-6 lg:grid-cols-2">
            {solutions.map(({ id, title, icon: Icon, description, includes, relatedServices }, index) => (
              <Reveal key={id} as="li" delay={(index % 2) * 0.08}>
                <article
                  id={id}
                  aria-labelledby={`${id}-title`}
                  className="group flex h-full scroll-mt-28 flex-col rounded-3xl border border-line bg-white p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover sm:p-10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-navy-900 text-cyan-300 transition-colors group-hover:bg-gradient-to-br group-hover:from-brand-600 group-hover:to-sky-500 group-hover:text-white">
                      <Icon className="size-7" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span aria-hidden="true" className="font-display text-3xl font-semibold text-brand-100">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 id={`${id}-title`} className="mt-7 text-2xl font-semibold text-navy-900">
                    {title}
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-muted">{description}</p>

                  <h3 className="mt-7 text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">Typically includes</h3>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {includes.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-navy-900">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand-600" strokeWidth={2.5} aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-8">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">Related services</h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {relatedServices.map((serviceId) => {
                        const service = getService(serviceId);
                        if (!service) return null;
                        return (
                          <li key={serviceId}>
                            <Link
                              href={`/services#${serviceId}`}
                              className="inline-flex rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-navy-800 transition-colors hover:border-brand-500 hover:text-brand-600"
                            >
                              {service.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </article>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      <CtaSection
        flushTop
        title="Find the right solution for your business."
        description="Every organisation is different. Share your challenge with us and we will suggest a practical way forward."
        secondary={{ label: "View Industries", href: "/industries" }}
      />
    </>
  );
}
