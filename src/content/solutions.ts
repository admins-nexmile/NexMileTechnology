import {
  AppWindow,
  Bot,
  Building2,
  CloudCog,
  LaptopMinimal,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

export type Solution = {
  id: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  description: string;
  /** Typical elements of the solution */
  includes: string[];
  /** Service ids from services.ts that support this solution */
  relatedServices: string[];
};

export const solutions: Solution[] = [
  {
    id: "enterprise-technology",
    title: "Enterprise Technology Solutions",
    icon: Building2,
    summary: "Integrated systems that connect people, processes and data across the organisation.",
    description:
      "As organisations grow, systems multiply and information becomes fragmented. We help bring core platforms, data and processes together into a coherent, manageable technology landscape.",
    includes: [
      "Enterprise system integration",
      "Trusted master and reference data",
      "Architecture planning and rationalisation",
      "Governance for core business systems",
    ],
    relatedServices: ["it-consulting", "master-data-management", "software-development"],
  },
  {
    id: "application-software",
    title: "Application and Software Solutions",
    icon: AppWindow,
    summary: "Custom and packaged applications configured to fit how your business actually works.",
    description:
      "Whether you need a new application, improvements to an existing one, or the right packaged software configured well, we focus on solutions your teams will actually use.",
    includes: [
      "Custom application development",
      "Configuration of packaged software",
      "Application integration through APIs",
      "Ongoing enhancement and support",
    ],
    relatedServices: ["software-development", "managed-services"],
  },
  {
    id: "device-endpoint",
    title: "Device and Endpoint Management",
    icon: Smartphone,
    summary: "Secure, centrally managed devices and endpoints for a mobile, distributed workforce.",
    description:
      "Laptops, desktops and mobile devices are where your people and your data meet. Consistent configuration, updates and security policies keep them productive and protected.",
    includes: [
      "Standardised device setup and configuration",
      "Security policies and updates for endpoints",
      "Device inventory and lifecycle tracking",
      "Support for remote and hybrid teams",
    ],
    relatedServices: ["cybersecurity", "managed-services"],
  },
  {
    id: "cloud",
    title: "Cloud Solutions",
    icon: CloudCog,
    summary: "Cloud platforms and services that improve flexibility, availability and scalability.",
    description:
      "We help you decide what belongs in the cloud, move it safely, and run it efficiently, with attention to security, resilience and cost.",
    includes: [
      "Cloud strategy and readiness",
      "Migration of applications and data",
      "Hybrid and multi-environment setups",
      "Cost and performance optimisation",
    ],
    relatedServices: ["cloud-infrastructure", "cybersecurity"],
  },
  {
    id: "business-automation",
    title: "Business Automation",
    icon: Bot,
    summary: "Automating repetitive, manual tasks to reduce errors and free teams for higher-value work.",
    description:
      "Many processes still rely on spreadsheets, email and re-keying data. Automation connects systems and removes manual steps so work flows faster and more reliably.",
    includes: [
      "Process discovery and prioritisation",
      "Workflow and approval automation",
      "System-to-system data integration",
      "Automated reporting",
    ],
    relatedServices: ["digital-transformation", "software-development"],
  },
  {
    id: "digital-workplace",
    title: "Digital Workplace Solutions",
    icon: LaptopMinimal,
    summary: "Modern collaboration and productivity tools that help teams work well from anywhere.",
    description:
      "A well-designed digital workplace gives people the tools, access and support they need to collaborate securely, whether they are in the office or working remotely.",
    includes: [
      "Collaboration and productivity platforms",
      "Secure access for remote and hybrid work",
      "User onboarding and support",
      "Adoption guidance and training",
    ],
    relatedServices: ["digital-transformation", "managed-services", "cybersecurity"],
  },
];
