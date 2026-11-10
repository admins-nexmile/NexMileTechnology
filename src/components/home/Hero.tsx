import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { siteConfig } from "@/config/site";
import { HeroVisual } from "./HeroVisual";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-navy-950 text-white"
    >
      {/* Background layers */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="bg-grid-dark absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div className="absolute -left-40 top-0 h-[36rem] w-[36rem] rounded-full bg-brand-600/30 blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-sky-500/20 blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      </div>

      <Container className="grid items-center gap-14 py-20 sm:py-24 lg:grid-cols-12 lg:gap-8 lg:py-28">
        <div className="lg:col-span-7">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300 backdrop-blur">
              <span className="animate-pulse-soft size-1.5 rounded-full bg-cyan-300" aria-hidden="true" />
              {siteConfig.brandStatement}
            </p>
          </div>

          <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
            <h1
              id="hero-title"
              className="mt-7 text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl xl:text-[4.25rem]"
            >
              Technology That Takes Your Business{" "}
              <span className="text-gradient-brand">Further.</span>
            </h1>
          </div>

          <div className="animate-fade-up" style={{ animationDelay: "160ms" }}>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/75 sm:text-xl">
              Empowering businesses through innovative technology services, intelligent digital
              solutions, expert consulting, and professional technology training.
            </p>
          </div>

          <div className="animate-fade-up" style={{ animationDelay: "240ms" }}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <ButtonLink href="/services" size="lg" arrow>
                Explore Our Services
              </ButtonLink>
              <ButtonLink href="/contact" size="lg" variant="ghost-dark">
                Contact Us
              </ButtonLink>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
            <HeroVisual />
          </div>
        </div>
      </Container>
    </section>
  );
}
