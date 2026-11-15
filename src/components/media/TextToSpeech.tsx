"use client";
import { useEffect, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { InlineMessage, styles } from "../tools/surface/ToolSurface";
import { LocalSpeech } from "./LocalSpeech";

/*
 * Text to Speech with the browser's built-in voices (Web Speech API). It is a listening tool: browsers do not let a page
 * capture the synthesized audio, so there is no download. Voices marked "online" are services of the browser or OS vendor.
 */

const MAX_CHARS = 5000;

export function TextToSpeech() {
  const [mode, setMode] = useState("download");
  return <div className="space-y-5"><label className={styles.group}><span className={styles.label}>Speech mode</span><select aria-label="Speech mode" className={styles.field} value={mode} onChange={event => setMode(event.target.value)}><option value="download">Generate downloadable speech</option><option value="listen">Listen with a device voice</option></select></label>{mode === "download" ? <LocalSpeech /> : <DeviceSpeech />}</div>;
}

function DeviceSpeech() {
  const [supported, setSupported] = useState<boolean>(), [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [text, setText] = useState(""), [voiceName, setVoiceName] = useState(""), [rate, setRate] = useState(1), [pitch, setPitch] = useState(1);
  const [state, setState] = useState<"idle" | "speaking" | "paused">("idle");
  useEffect(() => {
    const available = typeof window !== "undefined" && "speechSynthesis" in window;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Speech support is only known in the browser, after hydration.
    setSupported(available);
    if (!available) return;
    const load = () => { const list = speechSynthesis.getVoices().filter(voice => voice.localService); setVoices(list); setVoiceName(current => list.some(voice=>voice.name===current)?current:(list.find(voice => voice.default) ?? list[0])?.name || ""); };
    load(); speechSynthesis.addEventListener("voiceschanged", load);
    return () => { speechSynthesis.removeEventListener("voiceschanged", load); speechSynthesis.cancel(); };
  }, []);
  const voice = voices.find(entry => entry.name === voiceName);
  function speak() {
    if(!voice?.localService)return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, MAX_CHARS));
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
    utterance.rate = rate; utterance.pitch = pitch;
    utterance.onend = utterance.onerror = () => setState("idle");
    speechSynthesis.speak(utterance); setState("speaking");
  }
  const local = voices.filter(entry => entry.localService), online = voices.filter(entry => !entry.localService);

  return <section aria-label="Text to Speech workspace" className={styles.root}>
    <div className={styles.surface}>
      <div className={styles.stage} style={{ backgroundImage: "none", background: "var(--raised)", alignItems: "stretch", minHeight: "20rem" }}>
        <label className="flex w-full flex-col gap-2"><span className={styles.label}>Text to read<span className={styles.value}>{text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span></span>
          <textarea className={styles.field} aria-label="Text to read" rows={12} maxLength={MAX_CHARS} value={text} onChange={event => setText(event.target.value)} placeholder="Type or paste the text you want to hear…" style={{ resize: "vertical", minHeight: "16rem", lineHeight: 1.6 }} />
        </label>
      </div>
      <div className={styles.side}>
        <div className={styles.sideBody}>
          <h2 className="sr-only">Voice settings</h2>
          {supported === false && <InlineMessage role="alert" tone="error">This browser has no speech synthesis. Try a current Chrome, Edge, Safari or Firefox.</InlineMessage>}
          {supported && !voices.length && <p className={styles.help}>No local voice is available yet. Install an offline system voice, or switch Speech mode to Generate downloadable speech.</p>}
          {voices.length > 0 && <label className={styles.group}><span className={styles.label}>Voice</span>
            <select className={styles.field} aria-label="Voice" value={voiceName} onChange={event => setVoiceName(event.target.value)}>
              {local.length > 0 && <optgroup label="On this device">{local.map(entry => <option key={entry.name} value={entry.name}>{entry.name} ({entry.lang})</option>)}</optgroup>}
              {online.length > 0 && <optgroup label="Online (sent to your browser's provider)">{online.map(entry => <option key={entry.name} value={entry.name}>{entry.name} ({entry.lang})</option>)}</optgroup>}
            </select>
            {voice && !voice.localService && <span className={styles.help}>This voice is an online service of your browser or system vendor: the text is sent to them to be spoken. Choose a voice under &ldquo;On this device&rdquo; to keep it local.</span>}
          </label>}
          <label className={styles.group}><span className={styles.label}>Speed<span className={styles.value}>{rate.toFixed(1)}×</span></span><input className={styles.range} type="range" aria-label="Speed" min={0.5} max={2} step={0.1} value={rate} onChange={event => setRate(Number(event.target.value))} /></label>
          <label className={styles.group}><span className={styles.label}>Pitch<span className={styles.value}>{pitch.toFixed(1)}</span></span><input className={styles.range} type="range" aria-label="Pitch" min={0.5} max={2} step={0.1} value={pitch} onChange={event => setPitch(Number(event.target.value))} /></label>
          <InlineMessage tone="info" title="Listening only">Device voices cannot be downloaded. Switch Speech mode to Generate downloadable speech for local English SpeechT5 and a real WAV file.</InlineMessage>
        </div>
        <div className={styles.sideFoot}>
          <button type="button" className={styles.primary} disabled={!supported || !text.trim() || !voice?.localService} onClick={state === "paused" ? () => { speechSynthesis.resume(); setState("speaking"); } : speak}><Play aria-hidden size={16} />{state === "paused" ? "Resume" : "Speak"}</button>
          <div className={styles.row}>
            <button type="button" className={styles.secondary} disabled={state !== "speaking"} onClick={() => { speechSynthesis.pause(); setState("paused"); }}><Pause aria-hidden size={15} />Pause</button>
            <button type="button" className={styles.secondary} disabled={state === "idle"} onClick={() => { speechSynthesis.cancel(); setState("idle"); }}><Square aria-hidden size={15} />Stop</button>
          </div>
          <p role="status" aria-live="polite" className={styles.note}>{state === "speaking" ? "Speaking…" : state === "paused" ? "Paused." : ""}</p>
        </div>
      </div>
    </div>
  </section>;
}
