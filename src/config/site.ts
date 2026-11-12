/**
 * Central site configuration.
 *
 * Contact details: only values verified on the existing Google Sites website
 * (sites.google.com/nexmiletechnology.com/nexmiletechnology, Contact Us page)
 * are filled in. Every other field is an EDITABLE PLACEHOLDER set to `null`,
 * and the site hides any field that is still `null`. Fill them in here once
 * the company confirms them.
 */

export const siteConfig = {
  name: "NexmileTechnology",
  legalName: "Nexmile Technology",
  tagline: "Technology That Takes Your Business Further.",
  brandStatement: "Innovate. Build. Transform.",
  description:
    "NexmileTechnology is a multi-technology IT services, software development, technology consulting, digital solutions and professional technology training company.",
  /** Production domain. Used for SEO metadata only; nothing is deployed. */
  url: "https://www.nexmiletechnology.com",

  contact: {
    /** Verified: listed on the existing Google Sites "Contact Us" page. */
    email: "admins@nexmiletechnology.com",
    /** Verified: "India" is listed on the existing Google Sites "Contact Us" page. */
    location: "India",

    /** PLACEHOLDER: add the business phone number, e.g. "+91 00000 00000". */
    phone: null as string | null,
    /** PLACEHOLDER: add the full postal address when confirmed. */
    address: null as string | null,
    /** PLACEHOLDER: add business hours when confirmed, e.g. "Mon–Fri, 9:30 AM – 6:30 PM IST". */
    hours: null as string | null,
  },

  /**
   * Contact form delivery.
   * PLACEHOLDER: no backend or form service is configured yet, so the form
   * cannot send messages. Set `endpoint` to a form-service URL that accepts a
   * JSON POST (fields: name, email, phone, subject, message) to enable sending.
   * Until then, the form validates input and offers to open the visitor's email
   * app with the message pre-filled; it never claims the enquiry was delivered.
   */
  contactForm: {
    endpoint: null as string | null,
  },

  /** PLACEHOLDER: add official profile URLs. Empty values are hidden. */
  social: {
    linkedin: null as string | null,
    x: null as string | null,
    facebook: null as string | null,
    instagram: null as string | null,
    youtube: null as string | null,
  },
} as const;

export type NavItem = { label: string; href: string };

export const mainNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Solutions", href: "/solutions" },
  { label: "Industries", href: "/industries" },
  { label: "Training", href: "/training" },
  { label: "Careers", href: "/careers" },
  { label: "Contact Us", href: "/contact" },
];

export const ctaLink: NavItem = { label: "Get in Touch", href: "/contact" };

/** Employee portal (HRMS) sign-in. Invitation-only, Google accounts. */
export const loginLink: NavItem = { label: "Employee Login", href: "/hrms/login" };
