import { cn } from "@/hrms/lib/utils/cn";

type AvatarProps = {
  name: string;
  size?: "sm" | "md";
  className?: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Initials avatar. Decorative: the name should be shown or labelled nearby. */
export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800",
        size === "sm" ? "size-8 text-xs" : "size-10 text-sm",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
