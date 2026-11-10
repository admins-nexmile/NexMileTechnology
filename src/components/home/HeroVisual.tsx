import Image from "next/image";
import {
  Cloud,
  Code2,
  GraduationCap,
  Database,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import mark from "../../../public/brand/nexmile-mark.png";

type Node = { icon: LucideIcon; label: string; angle: number };

/** Capability areas placed around the outer orbit (angles in degrees, 0 = right). */
const nodes: Node[] = [
  { icon: Code2, label: "Software", angle: -90 },
  { icon: Cloud, label: "Cloud", angle: -30 },
  { icon: ShieldCheck, label: "Security", angle: 30 },
  { icon: Database, label: "Data", angle: 90 },
  { icon: Workflow, label: "Automation", angle: 150 },
  { icon: GraduationCap, label: "Training", angle: 210 },
];

/**
 * Decorative hero illustration echoing the orbit in the NexmileTechnology logo.
 * Purely visual: hidden from assistive technology.
 */
export function HeroVisual() {
  const radius = 43; // % of the square, for the outer orbit nodes

  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[30rem] select-none">
      {/* Glow */}
      <div className="absolute inset-[18%] rounded-full bg-sky-500/25 blur-3xl" />

      {/* Orbits */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="orbit-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#00a0f0" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="orbit-b" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a7fd4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1a7fd4" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <circle cx="200" cy="200" r="172" fill="none" stroke="rgb(255 255 255 / 0.08)" />
        <circle cx="200" cy="200" r="120" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeDasharray="2 6" />

        <g className="animate-orbit-slow origin-center [transform-box:view-box]">
          <circle cx="200" cy="200" r="172" fill="none" stroke="url(#orbit-a)" strokeWidth="1.5" strokeDasharray="180 900" strokeLinecap="round" />
          <circle cx="372" cy="200" r="4" fill="#67e8f9" />
        </g>
        <g className="animate-orbit-slower origin-center [transform-box:view-box]">
          <ellipse cx="200" cy="200" rx="150" ry="62" fill="none" stroke="url(#orbit-b)" strokeWidth="1.5" transform="rotate(-24 200 200)" />
          <circle cx="62" cy="258" r="3" fill="#00a0f0" />
        </g>
      </svg>

      {/* Core: official logo mark */}
      <div className="absolute left-1/2 top-1/2 flex size-[34%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_0_0_10px_rgb(255_255_255/0.06),0_0_60px_-4px_rgb(0_160_240/0.7)]">
        <Image src={mark} alt="" className="w-[68%]" sizes="160px" preload />
      </div>

      {/* Capability nodes */}
      {nodes.map(({ icon: Icon, label, angle }) => {
        const rad = (angle * Math.PI) / 180;
        const left = 50 + radius * Math.cos(rad);
        const top = 50 + radius * Math.sin(rad);
        return (
          <div
            key={label}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <span className="flex size-12 items-center justify-center rounded-2xl border border-white/15 bg-navy-900/80 text-cyan-300 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.6)] backdrop-blur sm:size-14">
              <Icon className="size-5 sm:size-6" strokeWidth={1.75} />
            </span>
            <span className="text-[0.7rem] font-medium tracking-wide text-white/70 sm:text-xs">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
