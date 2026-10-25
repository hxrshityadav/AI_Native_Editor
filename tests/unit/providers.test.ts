import { describe, expect, it } from "vitest";
import { getConfiguredProvider, getTranscriptionSetupError } from "@/lib/transcription/providers";

describe("server transcription configuration", () => {
  it.each([undefined, "", "   ", "your-groq-api-key", "key with spaces"])("rejects missing or placeholder credentials", (key) => {
    const env = { GROQ_API_KEY: key };
    expect(getConfiguredProvider(env)).toBeNull();
    expect(getTranscriptionSetupError(env)).toMatch(/GROQ_API_KEY.*\.env.local/);
  });
  it("uses Groq by default with a configured key", () => {
    expect(getConfiguredProvider({ GROQ_API_KEY: "test-key" })?.id).toBe("groq");
    expect(getTranscriptionSetupError({ GROQ_API_KEY: "test-key" })).toBeNull();
  });
  it("rejects unknown providers without echoing the value", () => {
    const env = { TRANSCRIBE_PROVIDER: "private-value", GROQ_API_KEY: "test-key" };
    expect(getConfiguredProvider(env)).toBeNull();
    expect(getTranscriptionSetupError(env)).toContain("TRANSCRIBE_PROVIDER");
    expect(getTranscriptionSetupError(env)).not.toContain("private-value");
  });
  it("explains Sarvam's key and opt-out requirements", () => {
    expect(getTranscriptionSetupError({ TRANSCRIBE_PROVIDER: "sarvam" })).toContain("SARVAM_API_KEY");
    expect(getTranscriptionSetupError({ TRANSCRIBE_PROVIDER: "sarvam", SARVAM_API_KEY: "test-key" })).toContain("SARVAM_TRAINING_OPT_OUT=confirmed");
  });
});
