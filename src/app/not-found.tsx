import type { Metadata } from "next";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <SiteChrome>
    <section className="py-28 sm:py-36">
      <Container className="max-w-2xl text-center">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">404</p>
        <h1 className="mt-4 text-4xl font-semibold text-navy-900 sm:text-5xl">Page not found</h1>
        <p className="mt-5 text-lg text-muted">
          The page you are looking for doesn&apos;t exist or is still being prepared.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/" arrow>
            Back to Home
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Contact Us
          </ButtonLink>
        </div>
      </Container>
    </section>
    </SiteChrome>
  );
}
