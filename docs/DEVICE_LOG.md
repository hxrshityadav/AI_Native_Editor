# Device log

One row per run. Use the lab's **Device report (for testing) → Copy device report** button at the
bottom of `/lab`. It copies a ready-made row for the table below, plus JSON. It contains no file
names, audio, transcript or video content. Put anything else you notice in the last column.

| Date | Device / OS | Browser | Clip (len, res, codecs) | Probe | Extract (time, size) | Transcribe | Render (time) | Result / error code | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-24 | Linux container (CI-like, not a real device) | Headless Chromium 153 | 4 s 720×1280 H.264/AAC (fixture) | OK | OK, 16.7 KB | mocked | ~3.6 s | OK | Automated E2E only |
| 2026-10-25 | **Emulated**: Pixel 7 viewport/UA, CPU ÷4 (not a real device) | HeadlessChrome 153 | 60 s 1080×1920 avc/aac | OK, 0.4 s | 11.6 s, 241 KB | mocked | 25.6 s (0.43× clip length), disk | OK | `npm run perf`. Desktop software codecs. Main thread 8.7% busy idle; longest stall 66 ms; Chromium RSS +743 MB during render (renderer +694) |
| 2026-10-25 | **Emulated**: as above | HeadlessChrome 153 | 20 s 720×1280 avc/aac | OK, 0.2 s | 4.2 s, 80 KB | mocked | 7.2 s (0.36×), disk | OK | RSS +664 MB: memory barely tracks frame size or clip length, so it's a fixed pipeline cost, not a leak |

## What the emulated runs can and can't tell us

- They can: main-thread jank, idle CPU, whether memory grows with clip length, crashes in our code.
- They can't: phone hardware encoder speed, real memory limits, thermal throttling, HEVC/HDR decode
  support, or how Android kills a background tab. Only a real phone answers those.
- Found and fixed through them: the preview redrew a full 1080×1920 frame 60 times a second while
  paused (47% main-thread busy at 4× throttle → 8.4%; worst stall during render 119 ms → 50 ms).
- Open question: about 650–800 MB of extra renderer memory during any render here. It's a fixed cost
  (codec threads and frame pools with desktop software codecs), not proportional to video length.
  **Measure it on the phone** (step 6 below): if a 3-minute 1080p render crashes the tab on a 4 GB
  phone, this is the first suspect.

## How to run on an Android phone (T-15)

### Setup (once)

1. On the phone: Settings → About phone → tap **Build number** 7 times, then Developer options →
   **USB debugging** on. Connect it to your laptop by USB and allow the prompt.
2. On the laptop, in this repo: put `GROQ_API_KEY=…` in `.env.local`, then
   `npm run build && npm run start`.
3. In desktop Chrome, open `chrome://inspect/#devices` → **Port forwarding…** → add `3000` →
   `localhost:3000` and tick **Enable port forwarding**.
4. In Chrome on the phone, open `http://localhost:3000/lab`. (WebCodecs needs a secure context, and
   `localhost` through port forwarding counts as one; your laptop's LAN IP does not.)

### Clips to test (record them on the phone itself)

| # | Clip | Why |
| --- | --- | --- |
| 1 | 30 s Hinglish talking head, portrait, **camera default settings** | The real-world case. Defaults are often HEVC and/or HDR |
| 2 | Same, with HDR off and the codec set to H.264 if 1 was HEVC/HDR | Confirms the warnings' advice works |
| 3 | 60 s, 1080p 30 fps | Typical Reel length |
| 4 | 3 min, 1080p 30 fps | Memory and heat stress; the input limit |
| 5 | 15 s at 4K 30 fps (if the phone records 4K) | Encoder limits |
| 6 | A video saved from WhatsApp | Common source; low bitrate, odd containers |

### For each clip

1. Pick it in the lab. Note any warnings (HDR, HEVC, landscape).
2. Extract audio, transcribe with **Hinglish**, fix 2–3 words in the editor, pick a style.
3. Play the preview: does it keep up? Is typing in the editor smooth?
4. Render. While it runs, scroll and type in the editor: the page should stay responsive.
5. Download the MP4. Open it in the phone's Gallery: does it play, are captions in sync, are colours
   right? Then try uploading it to Instagram as a Reel (draft only), which overlaps with T-13.
6. **Memory (clip 4 especially):** while the render runs, on the laptop run
   `adb shell dumpsys meminfo com.android.chrome | head -40` and note **TOTAL PSS**. Run it once
   before rendering and once at about 50% progress.
7. Open **Device report (for testing)**, tap **Copy device report**, and paste the row into the
   table above. Add memory, heat, crashes and anything odd to Notes.

### What counts as a pass

- Clips 1–3 render without a crash, the output plays in Gallery and uploads to Instagram.
- Captions look in sync to the eye (the precise ±150 ms check is T-11).
- The page stays usable during the render.
- Clip 4 either renders, or fails with our error message and recovery action, not a silent tab crash.
