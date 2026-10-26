import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/editor-models/[...asset]/route";
const request = new Request("http://localhost/editor-models/test");
afterEach(() => vi.unstubAllGlobals());
describe("model asset delivery", () => {
  it("streams only allowlisted public model files and preserves byte-length progress", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => { void input; return new Response("model", { headers: { "Content-Length": "5" } }); }); vi.stubGlobal("fetch", fetch);
    const response = await GET(request, { params: Promise.resolve({ asset: ["onnx-community", "whisper-tiny", "resolve", "main", "config.json"] }) });
    expect(response.status).toBe(200); expect(await response.text()).toBe("model"); expect(response.headers.get("Content-Length")).toBe("5");
    expect(fetch.mock.calls[0][0]).toBe("https://media.openreel.video/models/onnx-community/whisper-tiny/resolve/main/config.json");
  });
  it("rejects arbitrary models, URLs and file paths before fetching", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const asset of [["https:", "evil.example"], ["onnx-community", "other-model", "resolve", "main", "config.json"], ["onnx-community", "whisper-tiny", "resolve", "main", "..", "secret"]]) expect((await GET(request, { params: Promise.resolve({ asset }) })).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports asset failures without proxying upstream error bodies", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("untrusted", { status: 500 })));
    const response = await GET(request, { params: Promise.resolve({ asset: ["onnx-community", "whisper-tiny", "resolve", "main", "config.json"] }) });
    expect(response.status).toBe(502); expect(await response.text()).not.toContain("untrusted");
  });
});
