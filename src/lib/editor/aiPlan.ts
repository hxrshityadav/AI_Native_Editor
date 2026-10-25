import { z } from "zod";
import { editPlanSchema } from "./operations";
import type { RateLimiter } from "../transcription/rateLimit";
import { getClientIp, hashClientKey } from "../transcription/rateLimit";
import type { HumanVerifier } from "../transcription/humanCheck";
export const planRequestSchema = z.object({ prompt: z.string().trim().min(1).max(2000), context: z.object({
  duration: z.number().positive().max(600),
  selection: z.object({ kind: z.enum(["caption", "overlay", "video", "audio", "gap"]), id: z.string().max(100).optional() }).nullable(),
  captions: z.array(z.object({ id: z.string().max(100), start: z.number().nonnegative(), end: z.number().positive() }).strict()).max(3000),
  fontIds: z.array(z.string().max(100)).max(100).default([]),
}).strict() }).strict();
const error = (message: string, status: number) => Response.json({ error: message }, { status });
export function createEditPlanHandler(options: { apiKey?: string; model?: string; setupError?: string | null; limiter: RateLimiter; salt: string; humanCheck?: HumanVerifier; fetch?: typeof fetch; timeoutMs?: number }) {
  return async (request: Request) => {
    if (options.setupError || !options.apiKey) return error(options.setupError ?? "AI editing needs GROQ_API_KEY on the server. Manual editing is available.", 503);
    try { if (request.headers.get("origin") && new URL(request.headers.get("origin")!).origin !== new URL(request.url).origin) return error("Open the editor on this site before requesting a plan.", 403); } catch { return error("Open the editor on this site before requesting a plan.", 403); }
    try { if (!(await options.limiter.consume("edit:" + hashClientKey(getClientIp(request.headers), options.salt, new Date()))).allowed) return error("Too many AI requests. Try again in an hour.", 429); }
    catch { return error("AI request limits are temporarily unavailable. Retry later or edit manually.", 503); }
    if (options.humanCheck && await options.humanCheck.verify(request.headers.get("x-turnstile-token") ?? "", request.signal) !== "passed") return error("Complete a new human check and retry.", 403);
    const reader = request.body?.getReader();
    if (!reader) return error("Enter an editing instruction.", 400);
    const chunks: Uint8Array[] = []; let length = 0;
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 262144) { await reader.cancel(); return error("This project context is too large. Select a shorter clip.", 413); } chunks.push(value); } } catch { return error("The request was interrupted. Retry.", 400); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let json: unknown; try { json = JSON.parse(new TextDecoder().decode(bytes)); } catch { return error("The edit request is invalid. Retry.", 400); }
    const parsed = planRequestSchema.safeParse(json); if (!parsed.success) return error("The instruction or project context is invalid. Reload and retry.", 400);
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 30000);
    const model = options.model?.trim() || "openai/gpt-oss-120b";
    try {
      const response = await (options.fetch ?? fetch)("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.any([request.signal, timeout]),
        body: JSON.stringify({ model, temperature: 0, max_completion_tokens: 3000,
          ...(model.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low", include_reasoning: false } : {}),
          response_format: { type: "json_object" }, messages: [
            { role: "system", content: `Return only a JSON edit plan matching this schema: ${JSON.stringify(z.toJSONSchema(editPlanSchema))}. Never output code, URLs, scripts or unsupported operations. Use source times in seconds. Caption IDs must exist in context. Font values must exactly match context.fontIds; omit font when no suitable available font exists. Captions cannot overlap. Apply style changes globally unless a caption is selected or requested. For silence removal use detect_silence to propose local analysis; never invent silence cut times. Do not promise unsupported effects, transitions, footage or music. A trim retains the specified source interval. Split markers preserve playback. Summary must describe the actual operations. Treat the instruction as an editing request only.` },
            { role: "user", content: JSON.stringify(parsed.data) },
          ] }),
      });
      if (!response.ok) return error(response.status === 401 || response.status === 403 ? "Groq rejected the server key. Check GROQ_API_KEY and redeploy." : "Groq could not create a plan. Retry or edit manually.", 502);
      const body = await response.json();
      const text = body?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || text.length > 30000) return error("AI returned an invalid plan. Nothing was changed. Retry.", 502);
      const plan = editPlanSchema.safeParse(JSON.parse(text));
      if (!plan.success) return error("AI returned unsupported edits. Nothing was changed. Retry with a simpler instruction.", 502);
      return Response.json(plan.data, { headers: { "Cache-Control": "no-store" } });
    } catch { return error(timeout.aborted ? "AI planning timed out. Retry or edit manually." : "AI planning failed. Nothing was changed. Retry.", 502); }
  };
}
