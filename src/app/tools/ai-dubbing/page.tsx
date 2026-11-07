import { MissingToolPage, missingMetadata, siteViewport } from "@/components/media/MissingToolPage";
export const viewport = siteViewport;
export const metadata = missingMetadata("ai-dubbing");
export default function Page(){ return <MissingToolPage slug="ai-dubbing"/>; }
