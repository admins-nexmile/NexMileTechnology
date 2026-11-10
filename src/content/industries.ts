import {
  Briefcase,
  Cpu,
  Factory,
  GraduationCap,
  HeartPulse,
  Landmark,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export type Industry = {
  id: string;
  title: string;
  icon: LucideIcon;
  /** Typical technology needs of the sector. Not a claim of past deployments. */
  needs: string;
};

export const industries: Industry[] = [
  {
    id: "information-technology",
    title: "Information Technology",
    icon: Cpu,
    needs: "Scalable development capacity, cloud platforms and modern engineering practices.",
  },
  {
    id: "healthcare",
    title: "Healthcare",
    icon: HeartPulse,
    needs: "Secure handling of sensitive data, reliable systems and well-governed patient and provider records.",
  },
  {
    id: "education",
    title: "Education",
    icon: GraduationCap,
    needs: "Digital learning platforms, managed student and staff devices, and dependable IT support.",
  },
  {
    id: "banking-financial-services",
    title: "Banking and Financial Services",
    icon: Landmark,
    needs: "Strong security, regulatory awareness and resilient, high-availability systems.",
  },
  {
    id: "retail-ecommerce",
    title: "Retail and E-commerce",
    icon: ShoppingCart,
    needs: "Seamless digital storefronts, integrated operations and scalable infrastructure.",
  },
  {
    id: "manufacturing",
    title: "Manufacturing",
    icon: Factory,
    needs: "Process automation, connected operations and well-managed shop-floor devices.",
  },
  {
    id: "professional-services",
    title: "Professional Services",
    icon: Briefcase,
    needs: "Efficient digital workplaces, secure collaboration and streamlined client delivery.",
  },
];
