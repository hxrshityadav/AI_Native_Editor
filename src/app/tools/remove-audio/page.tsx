import { siteViewport } from "@/lib/site";
import { MediaToolPage, mediaMetadata } from "@/components/media/mediaPages";

export const viewport = siteViewport;
export const metadata = mediaMetadata("mute");
export default function Page() { return <MediaToolPage tool="mute" />; }
