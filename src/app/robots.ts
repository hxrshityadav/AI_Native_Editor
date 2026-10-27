import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/lab", "/studio-legacy", "/editor/", "/api/", "/editor-models/"] },
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
