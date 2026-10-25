// End-to-end test for the abuse controls (T-14): Turnstile gating in the browser, the token header,
// the server's refusals, and the shared limiter. Cloudflare's script is replaced by a stand-in,
// because automated browsers can't run the real one (and this container can't reach Cloudflare).
// Requires `npm run build`. Optional: E2E_DATABASE_URL=postgres://... to check the stored rows.
// Run: npm run e2e

import { join } from "node:path";
import { chromium } from "playwright";
import postgres from "postgres";
import { createChecks, makeFixtures, ROOT, startServer, stopServer } from "./helpers.mjs";

const OUT = join(ROOT, "tests/e2e/.out-abuse");
const PORT = 3119;
const BASE = `http://localhost:${PORT}`;
const { check, finish } = createChecks();
const DB = process.env.E2E_DATABASE_URL;

// Cloudflare's documented test keys (always pass) and dummy token. No real Groq key: every request
// here is refused before the provider.
const TURNSTILE = {
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  GROQ_API_KEY: "e2e-not-a-real-key",
};
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/** Stand-in for Cloudflare's api.js: records calls; issues a token when the test says so. */
const STUB = `window.turnstile = {
  calls: { render: [], reset: 0, remove: 0 },
  render(el, opts) { this.calls.render.push({ sitekey: opts.sitekey, appearance: opts.appearance }); this.opts = opts; return "w1"; },
  reset() { this.calls.reset++; },
  remove() { this.calls.remove++; },
  issue(token) { this.opts.callback(token); },
};`;

async function post(headers = {}) {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(64)]), "speech.ogg");
  const res = await fetch(`${BASE}/api/transcribe`, { method: "POST", body: form, headers });
  return { status: res.status, code: (await res.json()).error?.code };
}

async function main() {
  const f = makeFixtures(OUT);
  if (DB) await postgres(DB)`drop table if exists rate_limit_hits`.then(() => {});

  // ---------- Turnstile on ----------
  let server = await startServer(PORT, { env: { ...TURNSTILE, ...(DB ? { DATABASE_URL: DB } : {}) } });
  const browser = await chromium.launch();
  try {
    const config = await fetch(`${BASE}/api/transcribe`);
    check(
      "config GET returns the site key at request time, uncached",
      (await config.json()).humanCheckSiteKey === TURNSTILE.TURNSTILE_SITE_KEY && config.headers.get("cache-control") === "no-store",
    );
    const noToken = await post();
    check("upload without a token is refused before anything else", noToken.status === 403 && noToken.code === "HUMAN_CHECK_REQUIRED", JSON.stringify(noToken));

    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("pageerror:", e.message));
    let scriptRequests = 0;
    await page.route("https://challenges.cloudflare.com/**", (route) => {
      scriptRequests++;
      return route.fulfill({ contentType: "text/javascript", body: STUB });
    });
    const sentTokens = [];
    page.on("request", (r) => r.method() === "POST" && r.url().endsWith("/api/transcribe") && sentTokens.push(r.headers()["x-turnstile-token"]));

    await page.goto(`${BASE}/lab`);
    await page.getByTestId("file-input").setInputFiles(f("vertical.mp4"));
    await page.getByTestId("check-ok").waitFor({ timeout: 30_000 });
    check("disclosure names Cloudflare Turnstile and what it sees", (await page.getByTestId("transcribe-disclosure").innerText()).includes("Cloudflare Turnstile"));
    await page.getByTestId("extract-button").click();
    await page.getByTestId("extract-done").waitFor({ timeout: 60_000 });

    await page.waitForFunction(() => window.turnstile?.calls.render.length === 1);
    const rendered = await page.evaluate(() => window.turnstile.calls.render[0]);
    check("widget rendered once with the server's site key, shown only if interaction is needed", rendered.sitekey === TURNSTILE.TURNSTILE_SITE_KEY && rendered.appearance === "interaction-only", JSON.stringify(rendered));
    check(
      "Transcribe is disabled, with a visible reason, until the check passes",
      (await page.getByTestId("transcribe-button").isDisabled()) && (await page.getByTestId("human-check-status").isVisible()),
    );

    await page.evaluate((t) => window.turnstile.issue(t), DUMMY_TOKEN);
    check("Transcribe is enabled once a token arrives", await page.getByTestId("transcribe-button").isEnabled());
    await page.getByTestId("transcribe-button").click();
    await page.getByTestId("transcribe-error").waitFor({ timeout: 20_000 });
    check("the upload carries the token in its header", sentTokens.length === 1 && sentTokens[0] === DUMMY_TOKEN, JSON.stringify(sentTokens));
    // Siteverify is unreachable from this container, so the server must refuse, not let it through.
    const errorText = await page.getByTestId("transcribe-error").innerText();
    check("an unverifiable token is refused with a reason and a next step", errorText.includes("anti-bot check couldn't be completed") && errorText.includes("Try again"), errorText);
    check(
      "the spent token is dropped and the widget reset for a new one",
      (await page.evaluate(() => window.turnstile.calls.reset)) === 1 && (await page.getByTestId("transcribe-button").isDisabled()),
    );
    await page.evaluate((t) => window.turnstile.issue(t), "second-token");
    check("a fresh token re-enables Transcribe", await page.getByTestId("transcribe-button").isEnabled());
    check("Cloudflare's script is fetched once per page, not again for each token", scriptRequests === 1, `requests: ${scriptRequests}`);

    // Blocked script (content blocker, network): reason plus a working retry.
    const blocked = await browser.newPage();
    let block = true;
    await blocked.route("https://challenges.cloudflare.com/**", (route) =>
      block ? route.abort() : route.fulfill({ contentType: "text/javascript", body: STUB }),
    );
    await blocked.goto(`${BASE}/lab`);
    await blocked.getByTestId("human-check-error").waitFor({ timeout: 15_000 });
    check("a blocked check script shows a reason and a retry", (await blocked.getByTestId("human-check-error").innerText()).includes("couldn't load"));
    block = false;
    await blocked.getByRole("button", { name: "Retry check" }).click();
    await blocked.waitForFunction(() => window.turnstile?.calls.render.length === 1, null, { timeout: 10_000 });
    check("retry loads the check after the block is lifted", !(await blocked.getByTestId("human-check-error").isVisible()));

    if (DB) {
      const rows = await postgres(DB)`select key, count from rate_limit_hits`;
      check(
        "the shared limiter counted the upload under a hashed key, no raw IP",
        rows.length === 1 && /^[0-9a-f]{64}$/.test(rows[0].key) && rows[0].count === 1,
        JSON.stringify(rows.map((r) => ({ key: `${r.key.slice(0, 8)}…`, count: r.count }))),
      );
    } else {
      console.log("SKIP  shared limiter rows (set E2E_DATABASE_URL)");
    }
  } finally {
    await browser.close();
    stopServer(server);
  }

  // ---------- Limiter database down: refuse, don't run unmetered ----------
  server = await startServer(PORT, { env: { ...TURNSTILE, DATABASE_URL: "postgres://nobody@127.0.0.1:1/none" } });
  try {
    const down = await post({ "x-turnstile-token": DUMMY_TOKEN });
    check("limiter database down: refused with 503, not let through", down.status === 503 && down.code === "RATE_LIMIT_UNAVAILABLE", JSON.stringify(down));
  } finally {
    stopServer(server);
  }

  // ---------- A Vercel deployment without the controls stays off ----------
  server = await startServer(PORT, { env: { GROQ_API_KEY: TURNSTILE.GROQ_API_KEY, VERCEL: "1" } });
  try {
    const off = await post();
    const config = await (await fetch(`${BASE}/api/transcribe`)).json();
    check("public deployment without abuse controls refuses uploads", off.status === 503 && off.code === "ABUSE_CONTROLS_MISSING", JSON.stringify(off));
    check("and asks the browser for no check", config.humanCheckSiteKey === null);
  } finally {
    stopServer(server);
  }
  finish();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
