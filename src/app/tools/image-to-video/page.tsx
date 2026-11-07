import { MissingToolPage, missingMetadata, siteViewport } from "@/components/media/MissingToolPage";
export const viewport = siteViewport;
export const metadata = missingMetadata("image-to-video");
export default function Page(){ return <MissingToolPage slug="image-to-video"/>; }
