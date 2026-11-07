import { MissingToolPage, missingMetadata, siteViewport } from "@/components/media/MissingToolPage";
export const viewport = siteViewport;
export const metadata = missingMetadata("video-translator");
export default function Page(){ return <MissingToolPage slug="video-translator"/>; }
