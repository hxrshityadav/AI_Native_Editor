import { photoMetadata, ToolPage } from "@/components/images/ToolPage";
import { siteViewport } from "@/lib/site";
export const viewport = siteViewport;
export const metadata = photoMetadata("resizer");
export default function Page() { return <ToolPage tool="resizer" />; }
