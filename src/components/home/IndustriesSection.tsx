import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { industries } from "@/content/industries";

export function IndustriesSection() {
  return (
    <section aria-labelledby="industries-title" className="py-20 sm:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            id="industries-title"
            align="center"
            eyebrow="Industries We Serve"
            title="Technology shaped around your sector"
            description="Every industry has its own priorities, regulations and ways of working. We take the time to understand them so that technology fits your context."
          />
        </Reveal>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {industries.map(({ id, icon: Icon, title, needs }, index) => (
            <Reveal key={id} as="li" delay={(index % 4) * 0.07}>
              <div className="group h-full rounded-2xl border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-100 hover:shadow-card-hover">
                <div className="flex items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold leading-snug text-navy-900">{title}</h3>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted">{needs}</p>
              </div>
            </Reveal>
          ))}

          <Reveal as="li" delay={0.21}>
            <div className="flex h-full flex-col items-start justify-between gap-6 rounded-2xl border border-dashed border-brand-500/40 bg-brand-50/60 p-6">
              <p className="text-sm leading-relaxed text-navy-800">
                Don&apos;t see your industry? Our services apply across sectors. Let&apos;s discuss
                your needs.
              </p>
              <ButtonLink href="/industries" variant="secondary" arrow>
                View Industries
              </ButtonLink>
            </div>
          </Reveal>
        </ul>
      </Container>
    </section>
  );
}
