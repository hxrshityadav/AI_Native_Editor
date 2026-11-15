"use client";
import { useEffect, useRef, useState } from "react";
import { Music } from "lucide-react";
import type { MediaInfo } from "@/lib/mediatools/engine";
import { DEFAULT_MIX, type MixFormat, type MixOptions, type MixResult } from "@/lib/mediatools/mixer";
import { runMediaTask } from "@/lib/mediatools/client";
import { useBlobUrl } from "../tools/useBlobUrl";
import { DetailsTable, FileDetails, FileDropzone, FilePicker, InlineMessage, PrimaryButton, ProcessingPanel, ResultPanel, SegmentedChoice, Stage, ToolControls, ToolSurface, shortSize, styles, useResultView } from "../tools/surface/ToolSurface";

/* Music Mixer: voice or video -> add a music file -> levels, automatic ducking, fades, start point, loop -> one mixed file. */

const VOICE_ACCEPT = "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,video/mp4,video/webm,video/quicktime,.mkv";
const MUSIC_ACCEPT = "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac";
const FORMATS = [{ value: "m4a", label: "M4A (AAC)" }, { value: "wav", label: "WAV" }] as const;
const baseName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100) || "mix";
const db = (value: number) => `${value > 0 ? "+" : ""}${value} dB`;
const extension = (result: MixResult) => result.info.mime === "video/webm" ? "webm" : result.info.mime === "video/x-matroska" ? "mkv" : result.info.mime === "audio/wav" ? "wav" : result.video ? "mp4" : "m4a";

export function MusicMixer() {
  const [file, setFile] = useState<File>(), [info, setInfo] = useState<MediaInfo>(), [music, setMusic] = useState<File>(), [result, setResult] = useState<MixResult>();
  const [options, setOptions] = useState<MixOptions>(DEFAULT_MIX);
  const [busy, setBusy] = useState(""), [progress, setProgress] = useState<number>(), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const sourceUrl = useBlobUrl(file), musicUrl = useBlobUrl(music), resultUrl = useBlobUrl(result?.blob);
  const view = useResultView(!!(result && resultUrl));
  const changed = () => { setResult(undefined); setError(""); setNotice(""); setProgress(undefined); };
  const set = <K extends keyof MixOptions>(key: K, value: MixOptions[K]) => { setOptions(current => ({ ...current, [key]: value })); changed(); };
  function clear() { active.current?.abort(); active.current = null; setBusy(""); setFile(undefined); setInfo(undefined); setMusic(undefined); changed(); }
  function cancel() { active.current?.abort(); active.current = null; setBusy(""); setNotice("Cancelled. Your files are unchanged; you can try again."); }
  async function load(files: FileList) {
    clear();
    if (files.length !== 1) { setError("Choose one voice recording or video at a time."); return; }
    const selected = files[0], controller = new AbortController(); active.current = controller; setBusy("Reading the file…");
    try { const inspected = await runMediaTask({ kind: "inspect", file: selected, expect: "audio" }, controller.signal); if (!controller.signal.aborted) { setFile(selected); setInfo(inspected); } }
    catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "This file could not be read."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }
  async function mix() {
    if (!file) return;
    if (!music) { setError("Add a music file first."); return; }
    view.showLatest(); changed();
    const controller = new AbortController(); active.current?.abort(); active.current = controller; setBusy("Preparing…");
    try { const output = await runMediaTask({ kind: "mix", file, music, options }, controller.signal, setProgress, setBusy); if (!controller.signal.aborted) setResult(output); }
    catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "The mix could not be created."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }

  if (!info || !file) return <section aria-label="Music Mixer workspace" className={styles.root}>
    <FileDropzone icon={Music} title="Drop a voice recording or video here" pickLabel="Choose file" inputLabel="Choose voice or video file" accept={VOICE_ACCEPT} busy={busy} onCancel={cancel} onFiles={files => void load(files)}
      facts={<><span>Voice: MP3, WAV, M4A or a video</span><span>Up to 10 minutes</span><span>Music added next</span></>} />
    {notice && <InlineMessage role="status">{notice}</InlineMessage>}
    {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
  </section>;

  const video = !!info.video, ready = !!(result && resultUrl && view.showResult);
  return <section aria-label="Music Mixer workspace" className={styles.root}>
    <ToolSurface onFiles={files => void load(files)}
      file={<FileDetails name={file.name} factsLabel="Original details" onStartOver={clear}
        thumb={<span className={`${styles.thumb} grid place-items-center text-subtle`} aria-hidden><Music size={20} /></span>}
        picker={<FilePicker label="Replace file" inputLabel="Choose voice or video file" accept={VOICE_ACCEPT} onFiles={files => void load(files)} />}
        facts={<><span>{info.duration.toFixed(1)} s</span><span>{video ? `${info.video!.width} × ${info.video!.height}` : info.audio?.codec.toUpperCase()}</span><span>{shortSize(file.size)}</span></>} />}
      stage={<Stage plain busy={!!busy} processing={<ProcessingPanel title="Mixing" status={busy} progress={progress} onCancel={cancel} />}>
        {ready ? (video ? <video src={resultUrl} controls playsInline preload="metadata" aria-label="Mixed result preview" /> : <audio src={resultUrl} controls preload="metadata" aria-label="Mixed result preview" className="w-full max-w-md" />)
          : <div className="flex w-full max-w-md flex-col gap-4">
            <div className="flex flex-col gap-1"><span className={styles.label}>Voice</span>
              {sourceUrl && (video ? <video src={sourceUrl} controls playsInline preload="metadata" aria-label="Voice preview" /> : <audio src={sourceUrl} controls preload="metadata" aria-label="Voice preview" className="w-full" />)}</div>
            <div className="flex flex-col gap-1"><span className={styles.label}>Music</span>
              {musicUrl ? <audio src={musicUrl} controls preload="metadata" aria-label="Music preview" className="w-full" /> : <p className={styles.help}>No music added yet.</p>}</div>
          </div>}
      </Stage>}
      side={ready && result
        ? <ResultPanel headingRef={view.heading} heading="Mixed result" onAdjust={view.adjust} again={{ label: "Another file", onClick: clear }} note="Downloads a new file. Your voice and music files are unchanged."
          headline={video ? `Video with mixed audio` : result.info.mime === "audio/wav" ? "WAV mix" : "M4A mix"}
          summary={<>{result.info.duration.toFixed(1)} s, {shortSize(result.blob.size)}. {options.duck ? `Speech found in ${result.speechSeconds.toFixed(1)} s; the music was lowered for ${result.duckedSeconds.toFixed(1)} s.` : "Ducking was off."}{video ? " The picture was copied without re-encoding." : ""}</>}
          download={{ href: resultUrl!, filename: `${baseName(file.name)}-mix.${extension(result)}`, label: `Download ${extension(result).toUpperCase()}` }}>
          {result.clipped > 0 && <InlineMessage role="note" tone="warn">{result.clipped.toLocaleString()} samples were near full scale and were softened by the limiter. Lower the music or voice level if you hear distortion.</InlineMessage>}
          <DetailsTable original={{ title: "Voice", label: "Original file", rows: [["Length", `${info.duration.toFixed(2)} s`], ["Audio", info.audio?.codec.toUpperCase() ?? "-"], ["Size", shortSize(file.size)]] }}
            result={{ title: "Mix", label: "Output details", rows: [["Length", `${result.info.duration.toFixed(2)} s`], ["Audio", `${result.info.audio?.codec.toUpperCase() ?? "-"}, stereo, 48 kHz`], ["Music used", `${result.musicSeconds.toFixed(1)} s${options.loop && result.musicSeconds < info.duration - 0.5 ? ", looped" : ""}`], ["Size", shortSize(result.blob.size)]] }} />
        </ResultPanel>
        : <ToolControls title="Mix settings" controlsRef={view.controls} action={<>
          {notice && <InlineMessage role="status">{notice}</InlineMessage>}
          {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
          <PrimaryButton label="Mix" busyLabel="Mixing…" busy={!!busy} disabled={!music} onClick={() => void mix()} />
          {view.adjusting && <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={view.showLatest}>Back to result</button>}
        </>}>
          <div className={styles.group}>
            <span className={styles.label}>Music file</span>
            <div className={styles.row}>
              <FilePicker label={music ? "Replace music" : "Add music"} inputLabel="Music file" accept={MUSIC_ACCEPT} onFiles={files => { if (files[0]) { setMusic(files[0]); changed(); } }} />
              {music && <span className={styles.help}>{music.name.length > 40 ? `${music.name.slice(0, 37)}…` : music.name} · {shortSize(music.size)}</span>}
            </div>
            <p className={styles.help}>MP3, WAV, M4A, Ogg or FLAC. Only the part that fits under the voice is used.</p>
          </div>
          <label className={styles.group}><span className={styles.label}>Voice level<span className={styles.value}>{db(options.voiceGainDb)}</span></span>
            <input className={styles.range} type="range" aria-label="Voice level in decibels" min={-12} max={12} step={1} value={options.voiceGainDb} disabled={!!busy} onChange={event => set("voiceGainDb", Number(event.target.value))} /></label>
          <label className={styles.group}><span className={styles.label}>Music level<span className={styles.value}>{db(options.musicGainDb)}</span></span>
            <input className={styles.range} type="range" aria-label="Music level in decibels" min={-36} max={0} step={1} value={options.musicGainDb} disabled={!!busy} onChange={event => set("musicGainDb", Number(event.target.value))} />
            <span className={styles.help}>Background music usually sits 12 to 18 dB below the voice.</span></label>
          <SegmentedChoice legend="Automatic ducking" name="mix-duck" options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} value={options.duck ? "on" : "off"} disabled={!!busy} onChange={value => set("duck", value === "on")}
            hint={options.duck ? "The voice is analysed first. The music dips while someone speaks and rises again in pauses." : "The music stays at one level throughout."} />
          {options.duck && <label className={styles.group}><span className={styles.label}>Ducking depth<span className={styles.value}>{options.duckDepthDb} dB</span></span>
            <input className={styles.range} type="range" aria-label="Ducking depth in decibels" min={3} max={30} step={1} value={options.duckDepthDb} disabled={!!busy} onChange={event => set("duckDepthDb", Number(event.target.value))} /></label>}
          <div className={styles.row}>
            <label>Music fade in (s)<input className={styles.field} aria-label="Music fade in seconds" type="number" min={0} max={15} step={0.5} value={options.fadeIn} disabled={!!busy} onChange={event => set("fadeIn", Math.max(0, Math.min(15, Number(event.target.value) || 0)))} /></label>
            <label>Music fade out (s)<input className={styles.field} aria-label="Music fade out seconds" type="number" min={0} max={15} step={0.5} value={options.fadeOut} disabled={!!busy} onChange={event => set("fadeOut", Math.max(0, Math.min(15, Number(event.target.value) || 0)))} /></label>
          </div>
          <label className={styles.group}><span className={styles.label}>Start the music at (s)</span>
            <input className={styles.field} aria-label="Music start offset seconds" type="number" min={0} step={0.5} value={options.musicOffset} disabled={!!busy} onChange={event => set("musicOffset", Math.max(0, Number(event.target.value) || 0))} />
            <span className={styles.help}>Skips the start of the music, for example a long intro.</span></label>
          <label className={styles.help}><input type="checkbox" aria-label="Loop the music" checked={options.loop} disabled={!!busy} onChange={event => set("loop", event.target.checked)} /> Loop the music if it is shorter than the voice</label>
          {video ? <p className={styles.help}>The output keeps the video&apos;s container. The picture is copied as it is; only the audio is re-encoded.</p>
            : <SegmentedChoice legend="Output format" name="mix-format" options={FORMATS.map(option => ({ ...option }))} value={options.format} disabled={!!busy} onChange={(value: MixFormat) => set("format", value)}
              hint={options.format === "m4a" ? "AAC at 192 kbps. Small and widely playable." : "Uncompressed 16-bit audio. Large files."} />}
        </ToolControls>} />
  </section>;
}
