import { siteViewport } from "@/lib/site";
import { MediaToolPage, mediaMetadata } from "@/components/media/mediaPages";

export const viewport = siteViewport;
export const metadata = mediaMetadata("volume");
export default function Page() { return <MediaToolPage tool="volume" />; }
