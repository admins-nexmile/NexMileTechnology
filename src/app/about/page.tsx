import {
  Eye,
  Gem,
  HeartHandshake,
  Lightbulb,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { CtaSection } from "@/components/sections/CtaSection";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "About Us",
  description:
    "Learn about NexmileTechnology: a multi-technology IT services, software development, consulting, digital solutions and professional training company. Our mission, vision and values.",
  path: "/about",
});

const values = [
  { icon: ShieldCheck, title: "Integrity", text: "Honest advice, transparent communication and doing what we say we will do." },
  { icon: Users, title: "Customer focus", text: "Understanding each organisation's goals and shaping our work around them." },
  { icon: Gem, title: "Quality", text: "Careful, well-engineered work that is built to last and easy to maintain." },
  { icon: HeartHandshake, title: "Collaboration", text: "Working as one team with our clients, learners and partners." },
  { icon: Lightbulb, title: "Innovation", text: "Exploring new technologies and ideas, and applying them where they add real value." },
  { icon: RefreshCcw, title: "Continuous learning", text: "Growing our own skills and helping others grow theirs." },
];

const commitments = [
  "Listen first and understand your context before proposing solutions",
  "Recommend what fits your needs, not unnecessary complexity",
  "Communicate clearly on scope, progress and any risks",
  "Treat your data and systems with care and responsibility",
  "Stay engaged after delivery to support and improve",
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        current="About Us"
        eyebrow="About NexmileTechnology"
        title="Technology that helps businesses and people move forward"
        description={siteConfig.description}
      />

      {/* Introduction */}
      <section aria-labelledby="who-title" className="py-20 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <SectionHeading id="who-title" eyebrow="Who We Are" title="One partner across services, solutions and skills" />
          </Reveal>
          <Reveal delay={0.1} className="space-y-5 text-base leading-relaxed text-muted sm:text-lg lg:col-span-7">
            <p>
              NexmileTechnology brings together IT services, software development, technology
              consulting, digital solutions and professional technology training. From software
              development and cloud engineering to data management, we work across the technologies
              that modern organisations depend on.
            </p>
            <p>
              Because we both deliver technology and teach it, we understand the practical realities
              of building systems and the skills people need to make the most of them. Our aim is
              simple: to help businesses and individuals move forward through technology.
            </p>
            <p className="font-display text-xl font-semibold text-navy-800">
              {siteConfig.brandStatement}
            </p>
          </Reveal>
        </Container>
      </section>

      {/* Mission and vision */}
      <section aria-label="Mission and vision" className="pb-20 sm:pb-28">
        <Container className="grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-navy-800 p-9 text-white sm:p-12">
              <div aria-hidden="true" className="bg-grid-dark absolute inset-0 opacity-60" />
              <div className="relative">
                <span className="flex size-12 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
                  <Target className="size-6" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h2 className="mt-7 text-2xl font-semibold sm:text-3xl">Our Mission</h2>
                <p className="mt-4 text-base leading-relaxed text-white/75 sm:text-lg">
                  To empower businesses through innovative technology services, intelligent digital
                  solutions, expert consulting and professional technology training, delivered with
                  care, clarity and a focus on real outcomes.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="relative h-full overflow-hidden rounded-3xl border border-line bg-surface p-9 sm:p-12">
              <div aria-hidden="true" className="bg-grid-light absolute inset-0" />
              <div className="relative">
                <span className="flex size-12 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <Eye className="size-6" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h2 className="mt-7 text-2xl font-semibold text-navy-900 sm:text-3xl">Our Vision</h2>
                <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
                  To be a trusted technology partner that takes businesses further, helping
                  organisations innovate, build and transform, and helping people build rewarding
                  careers in technology.
                </p>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Values */}
      <section aria-labelledby="values-title" className="pb-20 sm:pb-28">
        <Container>
          <Reveal>
            <SectionHeading
              id="values-title"
              align="center"
              eyebrow="Our Values"
              title="The principles behind our work"
            />
          </Reveal>
          <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {values.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} as="li" delay={(index % 3) * 0.08}>
                <div className="group h-full rounded-2xl border border-line bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
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

      {/* Technology approach */}
      <ProcessSteps
        eyebrow="Our Technology Approach"
        title="Practical technology, thoughtfully delivered"
        description="We choose technology to fit the problem, not the other way round, and we work in clear stages so you always know where things stand."
      />

      {/* Customer commitment and continuous improvement */}
      <section aria-label="Our commitments" className="py-20 sm:py-28">
        <Container className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <SectionHeading
              eyebrow="Customer Commitment"
              title="What you can expect from us"
            />
            <ul className="mt-8 space-y-4">
              {commitments.map((item) => (
                <li key={item} className="flex items-start gap-3 text-base text-navy-900">
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                    <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M2.5 6.5l2.5 2 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="h-full rounded-3xl border border-line bg-gradient-to-br from-brand-50 to-white p-9 sm:p-12">
              <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-sky-500 text-white">
                <Sparkles className="size-6" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h2 className="mt-7 text-2xl font-semibold text-navy-900 sm:text-3xl">Continuous improvement</h2>
              <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
                Technology never stands still, and neither do we. We regularly review how we work,
                learn from every engagement and keep our skills current, so the advice, solutions and
                training we provide stay relevant.
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
                We focus on technology capabilities, practical solutions and continuous learning to
                support business and professional growth.
              </p>
            </div>
          </Reveal>
        </Container>
      </section>

      <CtaSection flushTop />
    </>
  );
}
