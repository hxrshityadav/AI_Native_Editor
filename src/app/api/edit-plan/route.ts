import { connection } from "next/server";
import { cloudProcessingEnabled, LOCAL_ONLY_MESSAGE, localOnlyResponse } from "@/lib/localMode";
export const maxDuration = 180;
export async function GET() {
  await connection();
  if (!cloudProcessingEnabled()) return Response.json({ setupError: LOCAL_ONLY_MESSAGE, humanCheckSiteKey: null, provider: null, romanizerName: null }, { headers: { "Cache-Control": "no-store" } });
  return (await import("./cloud")).GET();
}
export async function POST(request: Request) {
  if (!cloudProcessingEnabled()) return localOnlyResponse();
  return (await import("./cloud")).POST(request);
}
