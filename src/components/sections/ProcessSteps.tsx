import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { processSteps } from "@/content/process";

type ProcessStepsProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function ProcessSteps({
  eyebrow = "Our Approach",
  title = "A clear, collaborative way of working",
  description = "Every engagement follows the same practical principles, whatever the size or technology involved.",
}: ProcessStepsProps) {
  return (
    <section aria-labelledby="process-title" className="bg-surface py-20 sm:py-28">
      <Container>
        <Reveal>
          <SectionHeading id="process-title" align="center" eyebrow={eyebrow} title={title} description={description} />
        </Reveal>

        <div className="relative mt-16">
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-14 hidden h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent lg:block"
          />
        <ol className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {processSteps.map(({ icon: Icon, title: stepTitle, text }, index) => (
            <Reveal key={stepTitle} as="li" delay={index * 0.08} className="relative">
              <div className="flex h-full flex-col rounded-2xl border border-line bg-white p-7 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-800 to-brand-600 text-cyan-300 shadow-[0_10px_24px_-10px_rgb(0_40_120/0.7)]">
                    <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="font-display text-3xl font-semibold text-brand-100">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-navy-900">{stepTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        </div>
      </Container>
    </section>
  );
}
