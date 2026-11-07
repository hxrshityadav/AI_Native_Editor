import { siteViewport } from "@/lib/site";
import { MediaToolPage, mediaMetadata } from "@/components/media/mediaPages";

export const viewport = siteViewport;
export const metadata = mediaMetadata("audio-convert");
export default function Page() { return <MediaToolPage tool="audio-convert" />; }
