import { Compass, Hammer, LifeBuoy, Search, type LucideIcon } from "lucide-react";

export type ProcessStep = { icon: LucideIcon; title: string; text: string };

/** How NexmileTechnology approaches an engagement. Shared by About and Services. */
export const processSteps: ProcessStep[] = [
  {
    icon: Search,
    title: "Understand",
    text: "We learn about your goals, users, existing systems and constraints before recommending anything.",
  },
  {
    icon: Compass,
    title: "Plan",
    text: "We agree a clear scope, approach and priorities, so everyone knows what will be delivered and why.",
  },
  {
    icon: Hammer,
    title: "Build and implement",
    text: "We deliver in practical stages, sharing progress and adjusting as we learn.",
  },
  {
    icon: LifeBuoy,
    title: "Support and improve",
    text: "We help you run, refine and extend what has been delivered as your needs evolve.",
  },
];
