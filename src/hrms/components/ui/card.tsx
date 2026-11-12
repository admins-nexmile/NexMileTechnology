import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/hrms/lib/utils/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-surface shadow-sm",
        className,
      )}
      {...rest}
    />
  );
}

type CardHeaderProps = {
  title: string;
  titleId?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function CardHeader({
  title,
  titleId,
  description,
  action,
  className,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...rest} />;
}
