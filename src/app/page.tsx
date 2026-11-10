import type { Metadata } from "next";
import { ClosingCta } from "@/components/home/ClosingCta";
import { Hero } from "@/components/home/Hero";
import { IndustriesSection } from "@/components/home/IndustriesSection";
import { Intro } from "@/components/home/Intro";
import { ServicesOverview } from "@/components/home/ServicesOverview";
import { SolutionsOverview } from "@/components/home/SolutionsOverview";
import { TrainingIntro } from "@/components/home/TrainingIntro";
import { WhyNexmile } from "@/components/home/WhyNexmile";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.legalName,
  alternateName: siteConfig.name,
  url: siteConfig.url,
  logo: `${siteConfig.url}/brand/nexmile-logo.png`,
  description: siteConfig.description,
  slogan: siteConfig.tagline,
  email: siteConfig.contact.email,
  address: { "@type": "PostalAddress", addressCountry: "IN" },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }}
      />
      <Hero />
      <Intro />
      <ServicesOverview />
      <SolutionsOverview />
      <IndustriesSection />
      <TrainingIntro />
      <WhyNexmile />
      <ClosingCta />
    </>
  );
}
