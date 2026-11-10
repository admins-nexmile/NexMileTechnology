import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ContactForm } from "@/components/contact/ContactForm";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Get in touch with NexmileTechnology about IT services, software development, consulting, digital solutions or professional technology training.",
  path: "/contact",
});

type ContactItem = { icon: LucideIcon; label: string; value: string; href?: string };

export default function ContactPage() {
  const { contact } = siteConfig;

  // Only verified details are shown; placeholders left as null in site.ts are skipped.
  const items: ContactItem[] = [
    { icon: Mail, label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    ...(contact.phone
      ? [{ icon: Phone, label: "Phone", value: contact.phone, href: `tel:${contact.phone.replace(/\s+/g, "")}` }]
      : []),
    { icon: MapPin, label: contact.address ? "Address" : "Location", value: contact.address ?? contact.location },
    ...(contact.hours ? [{ icon: Clock, label: "Business hours", value: contact.hours }] : []),
  ];

  return (
    <>
      <PageHero
        current="Contact Us"
        eyebrow="Contact Us"
        title="Let's start a conversation"
        description="Whether you have a project in mind, a question about our services or an interest in training, we would be glad to hear from you."
      />

      <section aria-label="Contact details and enquiry form" className="py-20 sm:py-28">
        <Container className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <Reveal className="min-w-0 lg:col-span-5">
            <aside aria-labelledby="contact-details-title" className="relative h-full overflow-hidden rounded-3xl bg-navy-950 p-8 text-white sm:p-10 lg:p-8 xl:p-10">
              <div aria-hidden="true" className="bg-grid-dark absolute inset-0 opacity-70" />
              <div aria-hidden="true" className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-600/40 blur-3xl" />
              <div className="relative">
                <h2 id="contact-details-title" className="text-2xl font-semibold">
                  Contact {siteConfig.name}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  Reach us by email or send an enquiry using the form.
                </p>

                <dl className="mt-10 space-y-7">
                  {items.map(({ icon: Icon, label, value, href }) => (
                    <div key={label} className="flex items-start gap-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
                        <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">{label}</dt>
                        <dd className="mt-1 text-base font-medium [overflow-wrap:anywhere] lg:text-[0.9375rem] xl:text-base">
                          {href ? (
                            <a href={href} className="transition-colors hover:text-cyan-300">
                              {value}
                            </a>
                          ) : (
                            value
                          )}
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>

                <p className="mt-12 font-display text-sm font-semibold tracking-wide text-cyan-300">
                  {siteConfig.brandStatement}
                </p>
              </div>
            </aside>
          </Reveal>

          <Reveal delay={0.1} className="min-w-0 lg:col-span-7">
            <div className="rounded-3xl border border-line bg-white p-7 shadow-card sm:p-10">
              <h2 className="text-2xl font-semibold text-navy-900">Send us an enquiry</h2>
              <p className="mt-2 text-sm text-muted">Tell us a little about what you need and how we can help.</p>
              <div className="mt-8">
                <ContactForm />
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
