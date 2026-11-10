import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost-dark" | "outline-light";
type Size = "md" | "lg";

const base =
  "group inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus-visible:outline-offset-4";

const variants: Record<Variant, string> = {
  /** Main action on light or dark backgrounds */
  primary:
    "bg-brand-600 text-white shadow-[0_8px_24px_-8px_rgb(0_100_180/0.6)] hover:bg-brand-700 hover:shadow-[0_12px_28px_-8px_rgb(0_100_180/0.7)]",
  /** Secondary action on light backgrounds */
  secondary:
    "border border-line bg-white text-navy-800 hover:border-brand-500 hover:text-brand-600",
  /** Secondary action on dark backgrounds */
  "ghost-dark":
    "border border-white/20 bg-white/5 text-white backdrop-blur hover:border-cyan-300/60 hover:bg-white/10",
  /** High-contrast action on dark backgrounds */
  "outline-light": "bg-white text-navy-800 hover:bg-cyan-300 hover:text-navy-950",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

type ButtonLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "className"> & {
  variant?: Variant;
  size?: Size;
  className?: string;
  /** Show the trailing arrow that nudges on hover */
  arrow?: boolean;
  children: ReactNode;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  arrow = false,
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
      {arrow && (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      )}
    </Link>
  );
}
