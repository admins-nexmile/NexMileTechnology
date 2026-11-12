import {
  BookOpen,
  Briefcase,
  Building2,
  Code2,
  Cloud,
  Database,
  GraduationCap,
  Hammer,
  MessageSquare,
  Rocket,
  ShieldCheck,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import { CtaSection } from "@/components/sections/CtaSection";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Training",
  description:
    "Professional technology training from NexmileTechnology: practical, hands-on, career-focused learning for individuals and teams.",
  path: "/training",
});

const pillars = [
  {
    icon: Hammer,
    title: "Practical learning",
    text: "Learning by doing, with hands-on exercises that apply concepts to realistic scenarios.",
  },
  {
    icon: BookOpen,
    title: "Skill development",
    text: "Structured learning that builds understanding step by step, from fundamentals to applied skills.",
  },
  {
    icon: Rocket,
    title: "Career-focused training",
    text: "Skills chosen for their relevance to current technology roles and the way teams work today.",
  },
  {
    icon: MessageSquare,
    title: "Guided support",
    text: "Guidance and feedback during learning, so questions are answered and progress stays on track.",
  },
];

const areas = [
  { icon: Code2, title: "Software development" },
  { icon: Cloud, title: "Cloud technologies" },
  { icon: Database, title: "Data and Master Data Management" },
  { icon: ShieldCheck, title: "Cybersecurity fundamentals" },
  { icon: Workflow, title: "Automation and digital tools" },
  { icon: Briefcase, title: "Professional and workplace skills" },
];

const audiences = [
  { icon: GraduationCap, title: "Students and graduates", text: "Building practical skills to begin a career in technology." },
  { icon: UserRound, title: "Working professionals", text: "Updating skills or moving into a new technology area." },
  { icon: Users, title: "Career changers", text: "Gaining a structured, practical route into the technology field." },
  { icon: Building2, title: "Organisations", text: "Upskilling teams to adopt new tools, systems and ways of working." },
];

export default function TrainingPage() {
  return (
    <>
      <PageHero
        current="Training"
        eyebrow="Professional Training"
        title="Build your future with technology"
        description="Explore our professional training and develop practical skills for the evolving technology industry, through hands-on, career-focused learning."
      >
        <ButtonLink href="/contact" size="lg" arrow>
          Enquire About Training
        </ButtonLink>
      </PageHero>

      {/* Learning approach */}
      <section aria-labelledby="approach-title" className="py-20 sm:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              id="approach-title"
              align="center"
              eyebrow="Our Learning Approach"
              title="Training designed around real-world skills"
              description="Our training draws on the same technologies we work with, so learning stays practical and relevant."
            />
          </Reveal>
          <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} as="li" delay={index * 0.08}>
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

      {/* Technology areas */}
      <section
        aria-labelledby="areas-title"
        className="relative isolate overflow-hidden bg-navy-950 py-20 text-white sm:py-28"
      >
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="bg-grid-dark absolute inset-0 opacity-70" />
          <div className="absolute -right-20 top-0 h-[28rem] w-[28rem] rounded-full bg-brand-600/25 blur-[120px]" />
        </div>
        <Container className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <Reveal className="lg:col-span-5">
            <SectionHeading
              id="areas-title"
              tone="dark"
              eyebrow="Technology Areas"
              title="Learning aligned with our expertise"
              description="Our training focuses on the technology areas we work in every day. Contact us for details of current programmes, formats and availability."
            />
          </Reveal>
          <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            {areas.map(({ icon: Icon, title }, index) => (
              <Reveal key={title} as="li" delay={(index % 2) * 0.08}>
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-colors hover:border-cyan-300/40 hover:bg-white/10">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="font-medium">{title}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      {/* Who it is for */}
      <section aria-labelledby="audience-title" className="py-20 sm:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              id="audience-title"
              eyebrow="Who It Is For"
              title="Learning for individuals and teams"
            />
          </Reveal>
          <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {audiences.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} as="li" delay={index * 0.08}>
                <div className="h-full rounded-2xl border border-line bg-surface p-7">
                  <Icon className="size-7 text-brand-600" strokeWidth={1.75} aria-hidden="true" />
                  <h3 className="mt-5 text-lg font-semibold text-navy-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      <CtaSection
        flushTop
        title="Start your learning journey."
        description="Get in touch to learn about current training programmes, formats and how we can support your goals."
        primary={{ label: "Enquire About Training", href: "/contact" }}
        secondary={{ label: "About Us", href: "/about" }}
      />
    </>
  );
}
