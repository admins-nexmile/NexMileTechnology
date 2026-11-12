import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/hrms/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-slate-200 disabled:text-slate-500",
  secondary:
    "border border-line bg-surface text-ink hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400",
  ghost:
    "text-ink-muted hover:bg-slate-100 hover:text-ink disabled:text-slate-400",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  icon: "size-10",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "secondary",
  size = "md",
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    />
  );
}
