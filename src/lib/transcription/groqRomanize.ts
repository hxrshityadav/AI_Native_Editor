import { z } from "zod";
import { ProviderError, type Romanizer } from "./types";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_ROMANIZE_DEFAULT_MODEL = "openai/gpt-oss-120b";
/** Words per request: keeps each output short enough to come back reliably and fast. */
export const ROMANIZE_CHUNK = 200;
const TIMEOUT_MS = 30_000;

const DEVANAGARI = /[ऀ-ॿ]/;
export const hasDevanagari = (text: string) => DEVANAGARI.test(text);

const SYSTEM_PROMPT = `You convert words from a Hindi/Hinglish speech transcript into Hinglish, the way Indian creators write captions on Instagram: Roman script, everyday casual spellings.
Rules:
- Hindi words: common Hinglish spellings, e.g. है→hai, नहीं→nahi, क्या→kya, बहुत→bahut, दोस्तों→doston, आज→aaj, हम→hum, मैं→main, में→mein, यार→yaar, अच्छा→accha.
- English words written in Devanagari go back to normal English spelling, e.g. वीडियो→video, कैप्शन→caption, रील्स→reels, फॉलो→follow.
- Words already in Roman script stay exactly as they are.
- Keep punctuation attached to its word; turn । into a full stop.
- Do not translate, add, drop, merge or split words. Output exactly one item per input item, in the same order.`;

const outputSchema = z.object({ words: z.array(z.string()) });

export type GroqRomanizeOptions = { apiKey: string; model?: string; fetch?: typeof fetch };

export function createGroqRomanizer(options: GroqRomanizeOptions): Romanizer {
  const model = options.model ?? GROQ_ROMANIZE_DEFAULT_MODEL;
  const doFetch = options.fetch ?? fetch;

  async function romanizeChunk(words: string[], signal?: AbortSignal): Promise<string[]> {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
      res = await doFetch(GROQ_CHAT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          reasoning_effort: "low",
          include_reasoning: false,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify({ words }) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "hinglish_words",
              strict: true,
              schema: {
                type: "object",
                properties: { words: { type: "array", items: { type: "string" } } },
                required: ["words"],
                additionalProperties: false,
              },
            },
          },
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch {
      if (timeout.aborted) throw new ProviderError("PROVIDER_TIMEOUT", "Groq romanization timed out.");
      throw new ProviderError("PROVIDER_UNAVAILABLE", "Groq romanization request failed.");
    }
    if (!res.ok) {
      const code = res.status === 429 ? "PROVIDER_RATE_LIMITED" : "PROVIDER_UNAVAILABLE";
      throw new ProviderError(code, `Groq romanization error ${res.status}.`);
    }

    const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(body?.choices?.[0]?.message?.content ?? "");
    } catch {
      // handled below as a bad response
    }
    const out = outputSchema.safeParse(parsed);
    // The schema can't pin the array length, so check it, and check nothing was left in Devanagari.
    if (!out.success || out.data.words.length !== words.length) {
      throw new ProviderError("PROVIDER_BAD_RESPONSE", "Romanization returned a different number of words.");
    }
    return out.data.words.map((w, i) => {
      const text = w.trim();
      if (!text || hasDevanagari(text)) {
        throw new ProviderError("PROVIDER_BAD_RESPONSE", "Romanization left a word empty or in Devanagari.");
      }
      // Words that were already Roman script are never rewritten.
      return hasDevanagari(words[i]) ? text : words[i];
    });
  }

  return {
    async romanize(words, signal) {
      const chunks: string[][] = [];
      for (let i = 0; i < words.length; i += ROMANIZE_CHUNK) chunks.push(words.slice(i, i + ROMANIZE_CHUNK));
      const results = await Promise.all(
        chunks.map((chunk) => (chunk.some(hasDevanagari) ? romanizeChunk(chunk, signal) : Promise.resolve(chunk))),
      );
      return results.flat();
    },
  };
}
