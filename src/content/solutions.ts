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
};

export const solutions: Solution[] = [
  {
    id: "enterprise-technology",
    title: "Enterprise Technology Solutions",
    icon: Building2,
    summary:
      "Integrated systems that connect people, processes and data across the organisation.",
  },
  {
    id: "application-software",
    title: "Application and Software Solutions",
    icon: AppWindow,
    summary:
      "Custom and packaged applications configured to fit how your business actually works.",
  },
  {
    id: "device-endpoint",
    title: "Device and Endpoint Management",
    icon: Smartphone,
    summary:
      "Secure, centrally managed devices and endpoints for a mobile, distributed workforce.",
  },
  {
    id: "cloud",
    title: "Cloud Solutions",
    icon: CloudCog,
    summary:
      "Cloud platforms and services that improve flexibility, availability and scalability.",
  },
  {
    id: "business-automation",
    title: "Business Automation",
    icon: Bot,
    summary:
      "Automating repetitive, manual tasks to reduce errors and free teams for higher-value work.",
  },
  {
    id: "digital-workplace",
    title: "Digital Workplace Solutions",
    icon: LaptopMinimal,
    summary:
      "Modern collaboration and productivity tools that help teams work well from anywhere.",
  },
];
