import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // The employee portal is private and must never be indexed.
    rules: { userAgent: "*", allow: "/", disallow: "/hrms" },
    sitemap: new URL("/sitemap.xml", siteConfig.url).toString(),
  };
}
