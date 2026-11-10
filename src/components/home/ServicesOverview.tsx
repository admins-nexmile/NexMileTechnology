import Link from "next/link";
import { ArrowUpRight, MessagesSquare } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { services } from "@/content/services";

export function ServicesOverview() {
  return (
    <section aria-labelledby="services-title" className="relative bg-surface py-20 sm:py-28">
      <div aria-hidden="true" className="bg-grid-light pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />

      <Container className="relative">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <Reveal>
            <SectionHeading
              id="services-title"
              eyebrow="Our Services"
              title="End-to-end technology services"
              description="From strategy and development to data, security and ongoing support, we provide the services that help your technology work for your business."
            />
          </Reveal>
          <Reveal delay={0.1} className="shrink-0">
            <ButtonLink href="/services" variant="secondary" arrow>
              View All Services
            </ButtonLink>
          </Reveal>
        </div>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map(({ id, icon: Icon, title, summary }, index) => (
            <Reveal key={id} as="li" delay={(index % 4) * 0.07}>
              <Link
                href={`/services#${id}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-100 hover:shadow-card-hover"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-brand-600 to-cyan-400 transition-transform duration-500 group-hover:scale-x-100"
                />
                <span className="flex size-12 items-center justify-center rounded-xl bg-navy-800 text-cyan-300">
                  <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-lg font-semibold leading-snug text-navy-900">{title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{summary}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                  Learn more
                  <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
          ))}

          <Reveal as="li" delay={0.21}>
            <Link
              href="/contact"
              className="group flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-navy-800 via-brand-700 to-brand-600 p-7 text-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span className="flex size-12 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
                <MessagesSquare className="size-6" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="mt-6">
                <h3 className="text-lg font-semibold leading-snug">Not sure where to start?</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/75">
                  Tell us about your goals and we will help you identify the right approach.
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300">
                Talk to us
                <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </Reveal>
        </ul>
      </Container>
    </section>
  );
}
