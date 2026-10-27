/** Deployment supplies its public origin; never publish invented canonical URLs. */
export function siteOrigin(): string | undefined {
  const configured = process.env.SITE_URL;
  if (!configured) return undefined;
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SITE_URL must be the public HTTPS origin, without a path or credentials.");
  }
  return url.origin;
}
