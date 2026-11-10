import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  id?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  id,
}: SectionHeadingProps) {
  const centered = align === "center";
  const dark = tone === "dark";

  return (
    <div className={`max-w-3xl ${centered ? "mx-auto text-center" : ""}`}>
      <p
        className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] ${
          dark ? "text-cyan-300" : "text-brand-600"
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-px w-6 ${dark ? "bg-cyan-300" : "bg-brand-600"}`}
        />
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`mt-4 text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.75rem] ${
          dark ? "text-white" : "text-navy-900"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-5 text-base leading-relaxed sm:text-lg ${
            dark ? "text-white/70" : "text-muted"
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
