import { BookOpen, Check, Hammer, Rocket, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

const focusAreas = [
  {
    icon: Hammer,
    title: "Practical learning",
    text: "Hands-on exercises that apply concepts to realistic scenarios.",
  },
  {
    icon: BookOpen,
    title: "Skill development",
    text: "Structured learning in current technologies and tools.",
  },
  {
    icon: Rocket,
    title: "Career-focused",
    text: "Skills chosen for their relevance to today's technology roles.",
  },
  {
    icon: Users,
    title: "Individuals and teams",
    text: "Learning for professionals and for organisations upskilling their staff.",
  },
];

const outcomes = [
  "Build confidence with modern technologies",
  "Learn through practical, guided work",
  "Develop skills for the evolving technology industry",
];

export function TrainingIntro() {
  return (
    <section aria-labelledby="training-title" className="relative overflow-hidden bg-surface py-20 sm:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <Reveal>
            <SectionHeading
              id="training-title"
              eyebrow="Professional Training"
              title="Build your future with technology"
              description="Our professional technology training helps individuals and teams develop practical, in-demand skills through hands-on, career-focused learning."
            />
          </Reveal>
          <Reveal delay={0.1}>
            <ul className="mt-8 space-y-3">
              {outcomes.map((item) => (
                <li key={item} className="flex items-start gap-3 text-base text-navy-900">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-brand-600">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/training" arrow>
                Explore Training
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary">
                Enquire About Training
              </ButtonLink>
            </div>
          </Reveal>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2">
          {focusAreas.map(({ icon: Icon, title, text }, index) => (
            <Reveal
              key={title}
              as="li"
              delay={index * 0.08}
              className={index % 2 === 1 ? "sm:translate-y-8" : undefined}
            >
              <div className="h-full rounded-2xl border border-line bg-white p-7 shadow-card">
                <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-sky-500 text-white">
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
