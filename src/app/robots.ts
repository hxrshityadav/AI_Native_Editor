import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/lab", "/studio-legacy", "/editor/", "/api/", "/editor-models/", "/local-models/", "/local-ai/", "/pdfjs/"] },
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
