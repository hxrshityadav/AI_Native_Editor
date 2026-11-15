import { MissingToolPage, missingMetadata, siteViewport } from "@/components/media/MissingToolPage";
export const viewport = siteViewport;
export const metadata = missingMetadata("transcribe-to-text");
export default function Page(){ return <MissingToolPage slug="transcribe-to-text"/>; }
