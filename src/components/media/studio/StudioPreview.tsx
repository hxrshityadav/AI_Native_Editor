"use client";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Pause, Play } from "lucide-react";
import { activeIndex, captionBox, drawCaption, safeArea, type Caption, type CaptionStyle } from "@/lib/subtitles/captions";
import { paintFrame, type Composition } from "@/lib/subtitles/compose";
import css from "../SubtitleStudio.module.css";

/*
 * The preview is the export renderer: every displayed video frame is composed into a canvas at the export size with
 * paintFrame and drawCaption, the same functions the burn worker runs. The <video> element only decodes and plays
 * sound. Captions can be dragged; in crop mode, dragging the picture pans the framing.
 */
const stamp = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
type FrameVideo = HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number; cancelVideoFrameCallback?: (id: number) => void };

export function StudioPreview({ src, size, captions, style, composition, guides, fontReady, video, onStyle, onFraming, onTime, duration }: {
  src: string; size: { width: number; height: number }; captions: Caption[]; style: CaptionStyle; composition: Composition; guides: boolean; fontReady: boolean;
  video: React.RefObject<HTMLVideoElement | null>; onStyle: (patch: Partial<CaptionStyle>) => void; onFraming: (x: number, y: number) => void; onTime: (time: number) => void; duration: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null), drag = useRef<{ kind: "caption" | "frame"; dx: number; dy: number; startX: number; startY: number; framing: { x: number; y: number } } | null>(null);
  const [playing, setPlaying] = useState(false), [time, setTime] = useState(0), [snapped, setSnapped] = useState(false);

  const draw = useCallback((at?: number) => {
    const element = canvas.current, player = video.current as FrameVideo | null; if (!element) return;
    if (element.width !== size.width || element.height !== size.height) { element.width = size.width; element.height = size.height; }
    const ctx = element.getContext("2d")!, t = at ?? player?.currentTime ?? 0;
    paintFrame(ctx, size.width, size.height, player?.videoWidth || size.width, player?.videoHeight || size.height, composition, (x, y, w, h) => { if (player && player.readyState >= 2) ctx.drawImage(player, x, y, w, h); });
    if (fontReady) drawCaption(ctx, captions, t, style, size.width, size.height);
  }, [captions, style, composition, size, fontReady, video]);

  // Draw on every presented frame (requestVideoFrameCallback gives the exact media time), and once after seeks/edits.
  useEffect(() => {
    const player = video.current as FrameVideo | null; if (!player) return;
    let handle = 0, raf = 0;
    const frame = (_: number, meta: { mediaTime: number }) => { draw(meta.mediaTime); setTime(meta.mediaTime); onTime(meta.mediaTime); handle = player.requestVideoFrameCallback!(frame); };
    const loop = () => { draw(); setTime(player.currentTime); onTime(player.currentTime); if (!player.paused) raf = requestAnimationFrame(loop); };
    const start = () => { setPlaying(true); if (player.requestVideoFrameCallback) handle = player.requestVideoFrameCallback(frame); else raf = requestAnimationFrame(loop); };
    const stop = () => { setPlaying(false); draw(); setTime(player.currentTime); onTime(player.currentTime); };
    const once = () => { draw(); setTime(player.currentTime); onTime(player.currentTime); };
    player.addEventListener("play", start); player.addEventListener("pause", stop); player.addEventListener("seeked", once); player.addEventListener("loadeddata", once);
    draw();
    return () => { if (handle) player.cancelVideoFrameCallback?.(handle); cancelAnimationFrame(raf); player.removeEventListener("play", start); player.removeEventListener("pause", stop); player.removeEventListener("seeked", once); player.removeEventListener("loadeddata", once); };
  }, [draw, video, onTime]);

  const toCanvas = (event: PointerEvent) => { const box = canvas.current!.getBoundingClientRect(); return { x: (event.clientX - box.left) / box.width * size.width, y: (event.clientY - box.top) / box.height * size.height }; };
  function down(event: PointerEvent<HTMLCanvasElement>) {
    const point = toCanvas(event), ctx = canvas.current!.getContext("2d")!, box = captionBox(ctx, captions, video.current?.currentTime ?? 0, style, size.width, size.height);
    if (box && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) {
      drag.current = { kind: "caption", dx: point.x - (box.x + box.width / 2), dy: point.y - (box.y + box.height / 2), startX: point.x, startY: point.y, framing: composition.framing };
    } else if (composition.fit === "crop") drag.current = { kind: "frame", dx: 0, dy: 0, startX: point.x, startY: point.y, framing: composition.framing };
    else return;
    canvas.current!.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    const state = drag.current; if (!state) return;
    const point = toCanvas(event);
    if (state.kind === "frame") { onFraming(Math.min(1, Math.max(0, state.framing.x - (point.x - state.startX) / size.width)), Math.min(1, Math.max(0, state.framing.y - (point.y - state.startY) / size.height))); return; }
    const ctx = canvas.current!.getContext("2d")!, box = captionBox(ctx, captions, video.current?.currentTime ?? 0, style, size.width, size.height); if (!box) return;
    let cx = point.x - state.dx; const cy = point.y - state.dy;
    const snap = Math.abs(cx - size.width / 2) < size.width * 0.015; if (snap) cx = size.width / 2; setSnapped(snap);
    const x = style.align === "left" ? (cx - box.width / 2) / size.width : style.align === "right" ? (cx + box.width / 2) / size.width : cx / size.width;
    onStyle({ x: Math.round(x * 1000) / 1000, y: Math.round(cy / size.height * 1000) / 1000 });
  }
  const up = () => { drag.current = null; setSnapped(false); };
  const safe = safeArea(size.width, size.height, style.safeMargin);
  const toggle = () => { const player = video.current; if (!player) return; if (player.paused) void player.play(); else player.pause(); };

  return <div className={css.previewColumn}>
    <div className={css.frame} style={{ aspectRatio: `${size.width} / ${size.height}`, maxWidth: `calc(70vh * ${(size.width / size.height).toFixed(4)})` }}>
      <video ref={video} src={src} playsInline preload="auto" className={css.decoder} aria-hidden tabIndex={-1} />
      <canvas ref={canvas} className={css.stageCanvas} data-testid="caption-canvas" role="img" aria-label="Video preview with captions, at export size"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {guides && <span className={css.safe} aria-hidden style={{ left: `${safe.x * 100}%`, right: `${safe.x * 100}%`, top: `${safe.top * 100}%`, bottom: `${safe.bottom * 100}%` }} />}
      {snapped && <span className={css.snapLine} aria-hidden />}
    </div>
    <div className={css.transport}>
      <button type="button" className={css.icon} aria-label={playing ? "Pause" : "Play"} onClick={toggle}>{playing ? <Pause aria-hidden size={16} /> : <Play aria-hidden size={16} />}</button>
      <input type="range" className={css.scrub} aria-label="Playback position" min={0} max={duration} step={0.01} value={Math.min(time, duration)} onChange={event => { if (video.current) video.current.currentTime = Number(event.target.value); }} />
      <span className={css.clock}>{stamp(time)} / {stamp(duration)}</span>
    </div>
    <Timeline captions={captions} duration={duration} time={time} onSeek={t => { if (video.current) video.current.currentTime = t; }} />
  </div>;
}

/** Caption blocks along the video's length, with the playhead. Clicking seeks. */
function Timeline({ captions, duration, time, onSeek }: { captions: Caption[]; duration: number; time: number; onSeek: (t: number) => void }) {
  const active = activeIndex(captions, time);
  return <div className={css.timeline} role="presentation" onClick={event => { const box = event.currentTarget.getBoundingClientRect(); onSeek((event.clientX - box.left) / box.width * duration); }}>
    {captions.map((caption, index) => <span key={caption.id} className={css.block} data-active={index === active || undefined} style={{ left: `${caption.start / duration * 100}%`, width: `${Math.max(0.3, (caption.end - caption.start) / duration * 100)}%` }} />)}
    <span className={css.head} style={{ left: `${Math.min(100, time / Math.max(0.01, duration) * 100)}%` }} />
  </div>;
}
