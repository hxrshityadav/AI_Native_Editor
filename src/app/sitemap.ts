import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
import { photoToolPaths } from "@/lib/images/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return origin ? ["/", "/privacy", "/supported-formats", "/tools", ...photoToolPaths].map((path) => ({ url: `${origin}${path}` })) : [];
}
