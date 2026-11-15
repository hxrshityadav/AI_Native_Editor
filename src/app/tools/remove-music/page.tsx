import { MissingToolPage, missingMetadata, siteViewport } from "@/components/media/MissingToolPage";
export const viewport = siteViewport;
export const metadata = missingMetadata("remove-music");
export default function Page(){ return <MissingToolPage slug="remove-music"/>; }
