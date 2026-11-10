import { Handshake, Layers3, Puzzle, RefreshCcw, ShieldHalf, Target } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

const reasons = [
  {
    icon: Layers3,
    title: "Multi-technology capability",
    text: "Services, software, consulting and training under one roof, so your initiatives stay connected.",
  },
  {
    icon: Target,
    title: "Business-first approach",
    text: "We start with your goals and constraints, then recommend the technology that fits them.",
  },
  {
    icon: Puzzle,
    title: "Practical, tailored solutions",
    text: "Solutions sized to your needs, without unnecessary complexity.",
  },
  {
    icon: ShieldHalf,
    title: "Security in mind",
    text: "Security and responsible data handling are considered from the start, not added later.",
  },
  {
    icon: Handshake,
    title: "Partnership and transparency",
    text: "Clear communication and shared ownership of outcomes at every stage.",
  },
  {
    icon: RefreshCcw,
    title: "Continuous learning",
    text: "Our training focus keeps us engaged with evolving technologies and practices.",
  },
];

export function WhyNexmile() {
  return (
    <section aria-labelledby="why-title" className="py-20 sm:py-28">
      <Container>
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <Reveal>
                <SectionHeading
                  id="why-title"
                  eyebrow="Why NexmileTechnology"
                  title="A partner focused on your progress"
                  description="We focus on technology capabilities, practical solutions and continuous learning to support business and professional growth."
                />
              </Reveal>
            </div>
          </div>

          <ul className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:col-span-8">
            {reasons.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} as="li" delay={(index % 2) * 0.08}>
                <div className="relative pl-16">
                  <span className="absolute left-0 top-0 flex size-12 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600">
                    <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
