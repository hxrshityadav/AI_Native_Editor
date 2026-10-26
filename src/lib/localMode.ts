/** Cloud processing is opt-in for legacy deployments and isolated provider tests only. */
export const cloudProcessingEnabled = () => process.env.REEL_ENABLE_CLOUD === "1";
export const LOCAL_ONLY_MESSAGE = "Cloud processing is disabled. Use the browser editor's local caption model or edit captions manually.";
export const localOnlyResponse = () => Response.json({ code: "LOCAL_ONLY", error: LOCAL_ONLY_MESSAGE }, { status: 403, headers: { "Cache-Control": "no-store" } });
