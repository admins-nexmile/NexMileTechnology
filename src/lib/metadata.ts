import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

type PageMetadataInput = {
  /** Short page title; the layout template appends "| NexmileTechnology" */
  title: string;
  description: string;
  /** Path beginning with "/", used for the canonical URL */
  path: string;
};

/** Consistent per-page SEO metadata: title, description, canonical URL and social previews. */
export function pageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  const fullTitle = `${title} | ${siteConfig.name}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: fullTitle,
      description,
      url: path,
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}
