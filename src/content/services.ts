import {
  Cloud,
  Code2,
  Compass,
  Database,
  Headset,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type Service = {
  id: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  benefits: string[];
};

/** Initial service categories. These can be refined as the offering evolves. */
export const services: Service[] = [
  {
    id: "it-consulting",
    title: "IT Consulting and Technology Advisory",
    icon: Compass,
    summary:
      "Independent guidance to align technology decisions with business goals, from assessing current systems to planning a practical roadmap.",
    benefits: [
      "Clear, prioritised technology roadmap",
      "Better-informed investment decisions",
      "Reduced risk in major technology changes",
    ],
  },
  {
    id: "software-development",
    title: "Software and Application Development",
    icon: Code2,
    summary:
      "Design and development of web, mobile and business applications built around your processes, users and long-term maintainability.",
    benefits: [
      "Applications tailored to real workflows",
      "Modern, maintainable architecture",
      "Scalable foundations for future growth",
    ],
  },
  {
    id: "master-data-management",
    title: "Master Data Management (MDM)",
    icon: Database,
    summary:
      "Creating a single, trusted view of core business data such as customers, products and suppliers, supported by data quality and governance practices.",
    benefits: [
      "One consistent source of truth for key data",
      "Improved data quality and fewer duplicates",
      "Better reporting, compliance and decision-making",
    ],
  },
  {
    id: "cloud-infrastructure",
    title: "Cloud and Infrastructure Services",
    icon: Cloud,
    summary:
      "Planning, migration and management of cloud and on-premises infrastructure that is reliable, secure and cost-aware.",
    benefits: [
      "Flexible capacity that scales with demand",
      "Improved reliability and resilience",
      "Better control of infrastructure costs",
    ],
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity and IT Management",
    icon: ShieldCheck,
    summary:
      "Practical security measures and IT governance that protect data, systems and users while supporting day-to-day operations.",
    benefits: [
      "Stronger protection of data and systems",
      "Clear access and security policies",
      "Reduced exposure to common threats",
    ],
  },
  {
    id: "digital-transformation",
    title: "Digital Transformation",
    icon: Workflow,
    summary:
      "Modernising processes, systems and ways of working so that technology actively supports growth, efficiency and customer experience.",
    benefits: [
      "Streamlined, digitised processes",
      "Better use of business data",
      "Improved customer and employee experience",
    ],
  },
  {
    id: "managed-services",
    title: "Technical Support and Managed Services",
    icon: Headset,
    summary:
      "Ongoing technical support and proactive management of your IT environment so your teams can focus on their core work.",
    benefits: [
      "Responsive help when issues arise",
      "Proactive monitoring and maintenance",
      "Predictable, well-managed IT operations",
    ],
  },
];
