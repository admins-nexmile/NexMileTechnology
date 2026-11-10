import { Compass, GraduationCap, Layers3, Wrench } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

const pillars = [
  {
    icon: Wrench,
    title: "IT Services",
    text: "Dependable services that keep systems, devices and infrastructure running well.",
  },
  {
    icon: Layers3,
    title: "Software and Digital Solutions",
    text: "Applications and platforms built around how your business actually operates.",
  },
  {
    icon: Compass,
    title: "Technology Consulting",
    text: "Practical advice that connects technology choices to business priorities.",
  },
  {
    icon: GraduationCap,
    title: "Professional Training",
    text: "Hands-on learning that builds skills for the evolving technology industry.",
  },
];

export function Intro() {
  return (
    <section aria-labelledby="intro-title" className="py-20 sm:py-28">
      <Container className="grid gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Reveal>
            <SectionHeading
              id="intro-title"
              eyebrow="Who We Are"
              title="A multi-technology partner for growing businesses"
            />
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-5 text-base leading-relaxed text-muted sm:text-lg">
              <p>
                NexmileTechnology is a multi-technology IT services, software development,
                technology consulting, digital solutions and professional technology training
                company.
              </p>
              <p>
                We bring these capabilities together so organisations can plan, build, secure and
                support the technology they depend on, and develop the skills to make the most of
                it.
              </p>
            </div>
            <div className="mt-9">
              <ButtonLink href="/about" variant="secondary" arrow>
                More About Us
              </ButtonLink>
            </div>
          </Reveal>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2 lg:col-span-7">
          {pillars.map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} as="li" delay={index * 0.08}>
              <div className="group h-full rounded-2xl border border-line bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-100 hover:shadow-card-hover">
                <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 transition-colors group-hover:from-brand-600 group-hover:to-sky-500 group-hover:text-white">
                  <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-lg font-semibold text-navy-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
