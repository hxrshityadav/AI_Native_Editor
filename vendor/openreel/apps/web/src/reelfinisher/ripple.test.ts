import { describe, it, expect } from "vitest";
import type { Project, Clip } from "@openreel/core";
import { removeOutputRange } from "./ripple";
import { captionTrack, makeCaption } from "./caption-project";
import { estimatedWords, readCaption } from "./caption-data";

const mediaClip = (trackId: string, startTime = 0, duration = 8): Clip => ({ id: trackId + startTime, mediaId: "source", trackId, startTime, duration, inPoint: 10, outPoint: 10 + duration, effects: [], audioEffects: [], volume: 0.8, keyframes: [], transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, anchor: { x: 0.5, y: 0.5 }, rotation: 0, opacity: 1 } });
function fixture(): Project {
  const video = { ...captionTrack("Video"), id: "video", type: "video" as const, clips: [mediaClip("video")] };
  const audio = { ...captionTrack("Audio"), id: "audio", type: "audio" as const, clips: [mediaClip("audio")] };
  const text = { ...captionTrack(), id: "text" };
  const project: Project = { id: "project", name: "test", createdAt: 0, modifiedAt: 0, settings: { width: 1080, height: 1920, frameRate: 30, sampleRate: 48000, channels: 2 }, mediaLibrary: { items: [] }, timeline: { tracks: [video, audio, text], duration: 8, subtitles: [], markers: [{ id: "marker", time: 7, color: "#ffffff", label: "Beat" }] } };
  return { ...project, textClips: [makeCaption(project, text.id, "one two three four", 0, 8, { version: 1, kind: "caption", styleId: "clean", appearance: { boxOpacity: 0.8 }, animation: { effect: "fade", duration: 0.25, intensity: 0.5 }, words: estimatedWords("one two three four", 8), timing: "verified-words", referenceDuration: 8, referenceFontSize: 1 })] };
}
describe("synchronized output removal", () => {
  it("splits source bounds identically on video/audio and remaps words and markers without mutating input", () => {
    const project = fixture(), before = JSON.stringify(project); const next = removeOutputRange(project, 2, 4);
    expect(JSON.stringify(project)).toBe(before);
    for (const track of next.timeline.tracks.slice(0, 2)) expect(track.clips.map((clip) => [clip.startTime, clip.duration, clip.inPoint, clip.outPoint])).toEqual([[0, 2, 10, 12], [2, 4, 14, 18]]);
    expect(next.timeline.duration).toBe(6); expect(next.timeline.markers[0].time).toBe(5);
    expect(next.textClips?.map((clip) => clip.text).join(" ")).toBe("one three four");
    expect(readCaption(next.textClips![1])?.appearance.boxOpacity).toBe(0.8);
  });
  it("rejects an affected locked audio or caption track before modifying anything", () => {
    for (const id of ["audio", "text"]) { const p = fixture(); const locked = { ...p, timeline: { ...p.timeline, tracks: p.timeline.tracks.map((track) => ({ ...track, locked: track.id === id })) } }; expect(() => removeOutputRange(locked, 2, 4)).toThrow(/Unlock/); expect(locked.timeline.duration).toBe(8); }
  });
  it("allows locked tracks entirely before the edit and keeps their keyframes unchanged", () => {
    const p = fixture(), early = { ...captionTrack(), id: "early", locked: true, clips: [mediaClip("early", 0, 1)] }; p.timeline.tracks.push(early);
    expect(removeOutputRange(p, 2, 4).timeline.tracks.at(-1)).toEqual(early);
  });
  it("keeps constant-speed reversed source bounds correct", () => {
    const p = fixture(), clip = { ...p.timeline.tracks[0].clips[0], reversed: true, speed: 2, outPoint: 26 }; p.timeline.tracks[0].clips.splice(0, 1, clip);
    expect(removeOutputRange(p, 2, 4).timeline.tracks[0].clips.map((clip) => [clip.inPoint, clip.outPoint])).toEqual([[22, 26], [10, 18]]);
  });
  it("preserves linear keyframe and volume envelope values at new cut edges", () => {
    const p = fixture(), clip = { ...p.timeline.tracks[0].clips[0], keyframes: [{ id: "a", time: 0, property: "opacity", value: 0, easing: "linear" as const }, { id: "b", time: 8, property: "opacity", value: 1, easing: "linear" as const }], automation: { volume: [{ time: 0, value: 0 }, { time: 8, value: 1 }] } }; p.timeline.tracks[0].clips.splice(0, 1, clip);
    const parts = removeOutputRange(p, 2, 4).timeline.tracks[0].clips;
    expect(parts[0].keyframes.at(-1)?.value).toBe(0.25); expect(parts[1].keyframes[0].value).toBe(0.5);
    expect(parts[1].automation?.volume?.[0]).toEqual({ time: 0, value: 0.5 });
  });
  it("rejects an intersecting transition or speed ramp atomically", () => {
    const p = fixture(); p.timeline.tracks[0].transitions.push({ id: "transition", clipAId: p.timeline.tracks[0].clips[0].id, type: "crossfade", edge: "out", duration: 1, params: {} });
    expect(() => removeOutputRange(p, 6, 8)).toThrow(/transition/);
  });
  it("refuses invalid/empty-project ranges", () => { for (const [start, end] of [[0, 8], [-1, 2], [2, 2], [3, Infinity]]) expect(() => removeOutputRange(fixture(), start, end)).toThrow(/valid range/); });
  it("keeps a title's full wording on both sides of a removed range", () => {
    const p = fixture(), caption = p.textClips![0];
    const data = readCaption(caption)!;
    const project = { ...p, textClips: [{ ...caption, metadata: { ...caption.metadata, reelFinisher: { ...data, kind: "overlay" } } }] };
    expect(removeOutputRange(project, 2, 4).textClips?.map((clip) => clip.text)).toEqual(["one two three four", "one two three four"]);
  });
});
