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
  /** What the service typically covers */
  capabilities: string[];
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
    capabilities: [
      "Technology and systems assessments",
      "IT strategy and roadmap planning",
      "Solution and platform selection support",
      "Architecture and modernisation advice",
    ],
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
    capabilities: [
      "Custom web and business applications",
      "Mobile-friendly and responsive interfaces",
      "APIs and system integrations",
      "Enhancement and modernisation of existing applications",
    ],
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
    capabilities: [
      "Master data strategy and data model design",
      "Data matching, merging and survivorship rules",
      "Data quality, cleansing and standardisation",
      "Integration of MDM with source and downstream systems",
    ],
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
    capabilities: [
      "Cloud readiness and migration planning",
      "Cloud and hybrid infrastructure setup",
      "Backup, availability and recovery planning",
      "Infrastructure monitoring and optimisation",
    ],
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
    capabilities: [
      "Security reviews and risk identification",
      "Access management and security policies",
      "Endpoint and network security measures",
      "IT asset and governance practices",
    ],
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
    capabilities: [
      "Process review and digitisation",
      "Workflow and business process automation",
      "Legacy system modernisation",
      "Data-driven reporting and insights",
    ],
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
    capabilities: [
      "User and application support",
      "Proactive monitoring and maintenance",
      "Patch, update and configuration management",
      "Ongoing improvement of IT operations",
    ],
    benefits: [
      "Responsive help when issues arise",
      "Proactive monitoring and maintenance",
      "Predictable, well-managed IT operations",
    ],
  },
];

export function getService(id: string) {
  return services.find((service) => service.id === id);
}
