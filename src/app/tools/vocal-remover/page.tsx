import { MissingToolPage, missingMetadata, siteViewport } from "@/components/media/MissingToolPage";
export const viewport = siteViewport;
export const metadata = missingMetadata("vocal-remover");
export default function Page(){ return <MissingToolPage slug="vocal-remover"/>; }
