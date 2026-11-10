import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { solutions } from "@/content/solutions";

export function SolutionsOverview() {
  return (
    <section
      aria-labelledby="solutions-title"
      className="relative isolate overflow-hidden bg-navy-950 py-20 text-white sm:py-28"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="bg-grid-dark absolute inset-0 opacity-70" />
        <div className="absolute right-0 top-0 h-[30rem] w-[30rem] rounded-full bg-brand-600/25 blur-[120px]" />
        <div className="absolute -left-20 bottom-0 h-[24rem] w-[24rem] rounded-full bg-cyan-400/10 blur-[120px]" />
      </div>

      <Container>
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-8">
            <SectionHeading
              id="solutions-title"
              tone="dark"
              eyebrow="Technology Solutions"
              title="Solutions that connect people, processes and technology"
              description="We combine our services into focused solutions that address common business challenges, from unifying business data and automating work to moving to the cloud."
            />
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-4 lg:justify-self-end">
            <ButtonLink href="/solutions" variant="ghost-dark" arrow>
              Explore Solutions
            </ButtonLink>
          </Reveal>
        </div>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map(({ id, icon: Icon, title, summary }, index) => (
            <Reveal key={id} as="li" delay={(index % 3) * 0.08} className="bg-navy-950">
              <div className="group relative h-full p-8 transition-colors duration-300 hover:bg-navy-900 sm:p-10">
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan-300 transition-colors group-hover:border-cyan-300/40 group-hover:bg-cyan-300/10">
                    <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span aria-hidden="true" className="font-display text-sm font-semibold text-white/25">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-7 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">{summary}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
