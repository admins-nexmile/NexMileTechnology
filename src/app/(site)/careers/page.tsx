import { BookOpen, Compass, HeartHandshake, Lightbulb, Mail, Send } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Careers",
  description:
    "Explore careers at NexmileTechnology. Send a general career enquiry to join a multi-technology team focused on learning, quality and collaboration.",
  path: "/careers",
});

const careerMailto = `mailto:${siteConfig.contact.email}?subject=${encodeURIComponent("Career enquiry")}`;

const reasons = [
  {
    icon: Compass,
    title: "Varied technology work",
    text: "Work across services, software, data, cloud and training rather than a single narrow area.",
  },
  {
    icon: BookOpen,
    title: "A learning culture",
    text: "Continuous learning is part of what we do, for our clients, our learners and our own team.",
  },
  {
    icon: HeartHandshake,
    title: "Collaboration",
    text: "A team that shares knowledge, supports each other and takes shared ownership of outcomes.",
  },
  {
    icon: Lightbulb,
    title: "Room for ideas",
    text: "Space to contribute ideas and help shape how we work and the solutions we deliver.",
  },
];

const steps = [
  "Email your CV with the subject line “Career enquiry”.",
  "Tell us the type of role and technology areas that interest you.",
  "We will review your enquiry and get in touch if there is a suitable opportunity.",
];

export default function CareersPage() {
  return (
    <>
      <PageHero
        current="Careers"
        eyebrow="Careers"
        title="Grow your career with NexmileTechnology"
        description="We are always interested in hearing from people who are passionate about technology, learning and helping organisations move forward."
      />

      <section aria-labelledby="why-join-title" className="py-20 sm:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              id="why-join-title"
              align="center"
              eyebrow="Why Join Us"
              title="A place to learn, build and grow"
            />
          </Reveal>
          <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {reasons.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} as="li" delay={index * 0.08}>
                <div className="h-full rounded-2xl border border-line bg-white p-7 shadow-card">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
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

      <section aria-labelledby="enquiry-title" className="pb-20 sm:pb-28">
        <Container>
          <Reveal>
            <div className="relative isolate grid gap-12 overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-8 text-white sm:p-12 lg:grid-cols-2 lg:gap-16 lg:p-16">
              <div aria-hidden="true" className="absolute inset-0 -z-10">
                <div className="bg-grid-dark absolute inset-0 opacity-70" />
                <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Current Opportunities</p>
                <h2 id="enquiry-title" className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
                  No open positions are listed right now
                </h2>
                <p className="mt-5 text-base leading-relaxed text-white/75 sm:text-lg">
                  We don&apos;t have specific vacancies to advertise at the moment, but we welcome
                  general career enquiries. If you would like to be considered for future
                  opportunities, we would be glad to hear from you.
                </p>
                <a
                  href={careerMailto}
                  className="group mt-9 inline-flex h-13 items-center gap-2 rounded-full bg-white px-7 font-semibold text-navy-800 transition-colors hover:bg-cyan-300 hover:text-navy-950"
                >
                  <Send className="size-4" aria-hidden="true" />
                  Send a Career Enquiry
                </a>
                <p className="mt-5 flex items-center gap-2 text-sm text-white/60">
                  <Mail className="size-4" aria-hidden="true" />
                  {siteConfig.contact.email}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur sm:p-9">
                <h3 className="font-display text-lg font-semibold">How to apply</h3>
                <ol className="mt-6 space-y-5">
                  {steps.map((step, index) => (
                    <li key={step} className="flex gap-4">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 font-display text-sm font-semibold text-cyan-300">
                        {index + 1}
                      </span>
                      <p className="pt-1 text-sm leading-relaxed text-white/80">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
