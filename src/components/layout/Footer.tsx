import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ctaLink, mainNav, siteConfig } from "@/config/site";
import { services } from "@/content/services";
import logo from "../../../public/brand/nexmile-logo.png";

const socialLabels: Record<keyof typeof siteConfig.social, string> = {
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
};

export function Footer() {
  const { contact } = siteConfig;
  const socials = (Object.keys(siteConfig.social) as (keyof typeof siteConfig.social)[])
    .map((key) => ({ key, href: siteConfig.social[key], label: socialLabels[key] }))
    .filter((item): item is { key: typeof item.key; href: string; label: string } => Boolean(item.href));

  return (
    <footer className="relative overflow-hidden bg-navy-950 text-white/70">
      <div aria-hidden="true" className="bg-grid-dark pointer-events-none absolute inset-0 opacity-60" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[48rem] -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl"
      />

      <Container className="relative">
        <div className="grid gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-20">
          <div className="lg:col-span-4">
            <Link
              href="/"
              aria-label={`${siteConfig.name} home`}
              className="inline-flex rounded-xl bg-white px-4 py-3"
            >
              <Image src={logo} alt={siteConfig.name} className="h-8 w-auto" sizes="220px" />
            </Link>
            <p className="mt-6 max-w-sm text-sm leading-relaxed">{siteConfig.description}</p>
            <p className="mt-5 font-display text-sm font-semibold tracking-wide text-cyan-300">
              {siteConfig.brandStatement}
            </p>
          </div>

          <nav aria-label="Footer" className="lg:col-span-2">
            <h2 className="font-display text-sm font-semibold text-white">Company</h2>
            <ul className="mt-5 space-y-3 text-sm">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-cyan-300">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <h2 className="font-display text-sm font-semibold text-white">Services</h2>
            <ul className="mt-5 space-y-3 text-sm">
              {services.map((service) => (
                <li key={service.id}>
                  <Link href={`/services#${service.id}`} className="transition-colors hover:text-cyan-300">
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h2 className="font-display text-sm font-semibold text-white">Contact</h2>
            <ul className="mt-5 space-y-4 text-sm">
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-start gap-3 break-all transition-colors hover:text-cyan-300"
                >
                  <Mail className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden="true" />
                  {contact.email}
                </a>
              </li>
              {contact.phone && (
                <li>
                  <a
                    href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                    className="flex items-start gap-3 transition-colors hover:text-cyan-300"
                  >
                    <Phone className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden="true" />
                    {contact.phone}
                  </a>
                </li>
              )}
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden="true" />
                <span>{contact.address ?? contact.location}</span>
              </li>
            </ul>

            <Link
              href={ctaLink.href}
              className="mt-8 inline-flex h-10 items-center rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition-colors hover:border-cyan-300 hover:text-cyan-300"
            >
              {ctaLink.label}
            </Link>

            {socials.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-4 text-sm">
                {socials.map((social) => (
                  <li key={social.key}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-cyan-300"
                    >
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <CopyrightYear /> {siteConfig.legalName}. All rights reserved.
          </p>
          <p>{siteConfig.tagline}</p>
        </div>
      </Container>
    </footer>
  );
}

/**
 * Static year so the footer can be fully prerendered under Cache Components.
 * Reading the current date at request time would make every page dynamic.
 */
function CopyrightYear() {
  return <>2026</>;
}
