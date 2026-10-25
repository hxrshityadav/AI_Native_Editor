# Platform upload compatibility (T-13)

## What the platforms document (checked 2026-10-25)

| Platform | Source | Container and layout | Video | Audio |
| --- | --- | --- | --- | --- |
| YouTube | [Recommended upload encoding settings](https://support.google.com/youtube/answer/1722171) | MP4, no edit lists, **moov at the front (Fast Start)** | H.264 High, progressive, closed GOP, 4:2:0 | **AAC-LC or Opus**, 48 kHz |
| Instagram Reels (API) | [IG User Media reference](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media) | ≤ 300 MB | (see page) | **AAC**, ≤ 48 kHz, mono or stereo |
| Instagram Reels (app) | [Help: Reel size & aspect ratios](https://help.instagram.com/1038071743007909) | | 1.91:1 to 9:16, ≥ 720 px, ≥ 30 fps | |
| Facebook Reels | [Requirements for Facebook Reels](https://www.facebook.com/business/help/1197310377458196) | .mp4 recommended | H.264/H.265 recommended | **AAC Low Complexity** |
| WhatsApp (Business API) | [Media](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media) | | **H.264 only** | **AAC only** |
| WhatsApp (app) | [Help: send media](https://faq.whatsapp.com/web/chats/how-to-send-media/) | Default video limit 100 MB and 720p on faster connections | | |

The API specs describe programmatic uploads; the apps may accept more. Only real uploads settle it.

## What we changed because of this

- **Audio is AAC whenever possible.** AAC sources are copied untouched. Other audio (Opus from WebM,
  for example) is converted to AAC where the browser can encode it: Chrome on Android, Windows and
  Mac can; Linux Chromium can't. When it can't, the export keeps the original codec and the app
  warns that Instagram and WhatsApp document AAC only.
- **Fast start.** Exports streamed to disk now get moov moved to the front after rendering (the
  qt-faststart method; +~2 s for 60 s of 1080p; memory unchanged). In-memory exports already had it.

## Test pack

`npm run build && npm run compat-pack` writes `tests/compat/.out/reel-finisher-upload-test-pack.zip`
(6 files plus a README with each file's codecs and layout). Copy it to the phone and upload each file.

## Results (fill in)

Use a fresh draft or a private, close-friends or test account. For WhatsApp, send to yourself or a
test contact, and if possible to both an Android and an iPhone recipient.

| File | Instagram Reel (app) | YouTube Shorts (app) | WhatsApp chat: Android → Android | WhatsApp chat: → iPhone | WhatsApp Status |
| --- | --- | --- | --- | --- | --- |
| A ours, AAC, fast start | | | | | |
| B ours, from Opus source | | | | | |
| C ours, moov at end | | | | | |
| D ffmpeg control | | | | | |
| E landscape Fit | | | | | |
| F smaller 720p | | | | | |

For each cell write: **uploads?** / **plays with sound?** / **captions sharp?** (for example "✓ / ✓ / ✓", or
"✗: error text"). After the platform processes it, compare the captions against the file on the phone
for softness or shifts.

How to read the results:
- A fails but D passes → our export differs from the reference in a way that matters: compare the
  README rows and tell the team.
- A passes but C fails → fast start matters (already fixed in A).
- B fails only where the API docs say AAC only → expected when B's audio is Opus; on a phone or
  computer with Chrome, our exports would be AAC.
- Everything fails, D included → account, app or network problem, not the file.
