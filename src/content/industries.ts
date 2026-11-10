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
  /** Longer description of the sector's technology priorities */
  description: string;
  /** Areas where our services typically apply in this sector */
  focus: string[];
};

export const industries: Industry[] = [
  {
    id: "information-technology",
    title: "Information Technology",
    icon: Cpu,
    needs: "Scalable development capacity, cloud platforms and modern engineering practices.",
    description:
      "Technology companies need to deliver quickly without compromising quality, often while scaling teams and platforms at the same time.",
    focus: [
      "Additional software development capacity",
      "Cloud infrastructure and modernisation",
      "Skilled, up-to-date technical teams",
    ],
  },
  {
    id: "healthcare",
    title: "Healthcare",
    icon: HeartPulse,
    needs: "Secure handling of sensitive data, reliable systems and well-governed patient and provider records.",
    description:
      "Healthcare organisations depend on accurate information and systems that are available when they are needed, while protecting highly sensitive data.",
    focus: [
      "Consistent patient and provider data",
      "Security and access control",
      "Reliable, well-supported systems",
    ],
  },
  {
    id: "education",
    title: "Education",
    icon: GraduationCap,
    needs: "Digital learning platforms, managed student and staff devices, and dependable IT support.",
    description:
      "Schools, colleges and training providers need technology that supports teaching and administration, and is simple for staff and learners to use.",
    focus: [
      "Digital learning and collaboration tools",
      "Managed devices and user support",
      "Technology skills development",
    ],
  },
  {
    id: "banking-financial-services",
    title: "Banking and Financial Services",
    icon: Landmark,
    needs: "Strong security, regulatory awareness and resilient, high-availability systems.",
    description:
      "Financial organisations operate under close regulatory scrutiny, where data accuracy, security and system resilience are essential.",
    focus: [
      "Trusted customer and reference data",
      "Security and IT governance",
      "Resilient infrastructure and integration",
    ],
  },
  {
    id: "retail-ecommerce",
    title: "Retail and E-commerce",
    icon: ShoppingCart,
    needs: "Seamless digital storefronts, integrated operations and scalable infrastructure.",
    description:
      "Retailers need consistent product and customer information across channels, and platforms that can handle changing demand.",
    focus: [
      "Product and customer master data",
      "E-commerce and system integration",
      "Scalable cloud infrastructure",
    ],
  },
  {
    id: "manufacturing",
    title: "Manufacturing",
    icon: Factory,
    needs: "Process automation, connected operations and well-managed shop-floor devices.",
    description:
      "Manufacturers benefit from connecting operational and business systems, reducing manual work and improving visibility across the supply chain.",
    focus: [
      "Process and workflow automation",
      "Material, product and supplier data",
      "Connected systems and reporting",
    ],
  },
  {
    id: "professional-services",
    title: "Professional Services",
    icon: Briefcase,
    needs: "Efficient digital workplaces, secure collaboration and streamlined client delivery.",
    description:
      "Consultancies and service firms rely on their people, so tools for collaboration, knowledge sharing and secure client work are critical.",
    focus: [
      "Digital workplace and collaboration",
      "Secure access and data protection",
      "Process automation for delivery",
    ],
  },
];
