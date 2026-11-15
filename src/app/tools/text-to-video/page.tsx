import { MissingToolPage, missingMetadata, siteViewport } from "@/components/media/MissingToolPage";
export const viewport = siteViewport;
export const metadata = missingMetadata("text-to-video");
export default function Page(){ return <MissingToolPage slug="text-to-video"/>; }
