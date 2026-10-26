import type { Project, Clip, Keyframe } from "@openreel/core";
import { keyframeEngine } from "@openreel/core/video/keyframe-engine";
import { cloneProjectForEdit } from "../stores/project/clone-project-for-edit";
import { readCaption, currentWords, estimatedWords } from "./caption-data";
import { retainedPieces, sourceToEdited, remapWords } from "../../../../../../src/lib/editor/timeline";

type Timed = { readonly id: string; readonly trackId: string; readonly startTime: number; readonly duration: number; readonly keyframes?: Keyframe[] };
/** Project-wide edit. Nothing mutates until the caller commits the returned snapshot. */
export function removeOutputRange(input: Project, start: number, end: number): Project {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > input.timeline.duration + 0.001 || end - start >= input.timeline.duration - 0.001) throw new Error("Choose a valid range that leaves some project content.");
  const cuts = [{ start, end }];
  const map = (time: number) => sourceToEdited(time, cuts);
  const affected = (item: Timed) => item.startTime + item.duration > start;
  const items = [...input.timeline.tracks.flatMap((track) => track.clips), ...input.textClips ?? [], ...input.shapeClips ?? [], ...input.svgClips ?? [], ...input.stickerClips ?? []];
  if (items.some((item) => affected(item) && input.timeline.tracks.find((track) => track.id === item.trackId)?.locked)) throw new Error("Unlock affected tracks before synchronized removal. No changes were made.");
  if (items.some((item) => item.startTime < end && item.startTime + item.duration > start && item.keyframes?.some((frame) => frame.easing !== "linear" && frame.easing !== "hold"))) throw new Error("Synchronized removal across eased keyframes is not supported yet. Remove this easing or choose another range. No changes were made.");
  if (input.nestedInstances?.length || input.motionInstances?.length || input.multicamGroups?.length || input.masks?.length || input.adjustmentLayers?.length) throw new Error("Synchronized removal does not yet support nested sequences, motion compositions, masks, adjustment layers or multicam. No changes were made.");
  for (const track of input.timeline.tracks) {
    for (const transition of track.transitions) {
      const a = track.clips.find((clip) => clip.id === transition.clipAId);
      const b = track.clips.find((clip) => clip.id === transition.clipBId);
      const boundary = b?.startTime ?? (transition.edge === "in" ? a?.startTime : a ? a.startTime + a.duration : undefined);
      if (boundary !== undefined && start < boundary + transition.duration && end > boundary - transition.duration) throw new Error("Remove the transition at this cut before synchronized removal. No changes were made.");
    }
    for (const clip of track.clips) if (clip.startTime < end && clip.startTime + clip.duration > start && (clip.speedKeyframes?.length || clip.freezeFrames?.length)) throw new Error("Flatten speed ramps or freeze frames before removing this range. No changes were made.");
  }
  const keyframes = (frames: Keyframe[] | undefined, from: number, to: number): Keyframe[] => {
    if (!frames?.length) return [];
    const result = frames.filter((frame) => frame.time >= from && frame.time <= to).map((frame) => ({ ...frame, time: frame.time - from }));
    for (const property of new Set(frames.map((frame) => frame.property))) {
      const group = frames.filter((frame) => frame.property === property);
      for (const time of [from, to]) if (!group.some((frame) => Math.abs(frame.time - time) < 1e-7)) {
        const sample = keyframeEngine.getValueAtTime(group, time);
        result.push({ ...sample.keyframeA!, id: crypto.randomUUID(), property, time: time - from, value: sample.value });
      }
    }
    return result.sort((a, b) => a.time - b.time);
  };
  const next = cloneProjectForEdit(input);
  const splitMedia = (clip: Clip): Clip[] => {
    if (clip.startTime + clip.duration <= start) return [clip];
    if (clip.startTime >= end) return [{ ...clip, startTime: map(clip.startTime) }];
    return retainedPieces(clip.startTime, clip.startTime + clip.duration, cuts).map((piece, index) => {
    const from = piece.start - clip.startTime, to = piece.end - clip.startTime;
    const rate = (clip.outPoint - clip.inPoint) / clip.duration;
    const sourceStart = clip.reversed ? clip.outPoint - to * rate : clip.inPoint + from * rate;
    const sourceEnd = clip.reversed ? clip.outPoint - from * rate : clip.inPoint + to * rate;
    const automation = (points: { time: number; value: number }[] | undefined) => {
      if (!points?.length) return points;
      const frames: Keyframe[] = points.map((point, i) => ({ ...point, id: String(i), property: "value", easing: "linear" }));
      return keyframes(frames, from, to).map((frame) => ({ time: frame.time, value: frame.value as number }));
    };
    return { ...clip, id: index ? crypto.randomUUID() : clip.id, startTime: map(piece.start), duration: piece.end - piece.start, inPoint: sourceStart, outPoint: sourceEnd,
      keyframes: keyframes(clip.keyframes, from, to),
      automation: clip.automation ? { volume: automation(clip.automation.volume), pan: automation(clip.automation.pan) } : undefined,
      fade: clip.fade ? { fadeIn: from === 0 ? Math.min(clip.fade.fadeIn, to - from) : 0, fadeOut: to === clip.duration ? Math.min(clip.fade.fadeOut, to - from) : 0 } : undefined };
  }); };
  const splitOverlay = <T extends Timed>(clip: T): T[] => {
    if (clip.startTime + clip.duration <= start) return [clip];
    if (clip.startTime >= end) return [{ ...clip, startTime: map(clip.startTime) }];
    return retainedPieces(clip.startTime, clip.startTime + clip.duration, cuts).map((piece, index) => ({ ...clip,
    id: index ? crypto.randomUUID() : clip.id, startTime: map(piece.start), duration: piece.end - piece.start,
    keyframes: keyframes(clip.keyframes, piece.start - clip.startTime, piece.end - clip.startTime) })); };
  const textClips = (next.textClips ?? []).flatMap((clip) => {
    const data = readCaption(clip);
    if (!data) return splitOverlay(clip);
    if (data.kind === "overlay") return splitOverlay(clip).map((part) => ({ ...part, metadata: { ...part.metadata, reelFinisher: { ...data, words: estimatedWords(clip.text, part.duration), referenceDuration: part.duration } } }));
    const words = remapWords(currentWords(clip, data).map((word) => ({ ...word, start: word.start + clip.startTime, end: word.end + clip.startTime })), cuts);
    const newStart = map(clip.startTime), duration = map(clip.startTime + clip.duration) - newStart;
    if (duration <= 0 || !words.length) return [];
    // Split animated captions at the cut so keyframe interpolation cannot bridge deleted time.
    return splitOverlay(clip).map((part) => {
      const partWords = words.filter((word) => word.end > part.startTime && word.start < part.startTime + part.duration).map((word) => ({ ...word, start: Math.max(0, word.start - part.startTime), end: Math.min(part.duration, word.end - part.startTime) }));
      return { ...part, text: partWords.map((word) => word.text).join(" "), metadata: { ...part.metadata, reelFinisher: { ...data, words: partWords, referenceDuration: part.duration } } };
    }).filter((part) => part.text.length > 0);
  });
  return { ...next, textClips, shapeClips: next.shapeClips?.flatMap(splitOverlay), svgClips: next.svgClips?.flatMap(splitOverlay), stickerClips: next.stickerClips?.flatMap(splitOverlay),
    timeline: { ...next.timeline, duration: map(next.timeline.duration), tracks: next.timeline.tracks.map((track) => ({ ...track, clips: track.clips.flatMap(splitMedia) })),
      markers: next.timeline.markers.filter((marker) => marker.time < start || marker.time >= end).map((marker) => ({ ...marker, time: map(marker.time) })),
      beatMarkers: next.timeline.beatMarkers?.filter((marker) => marker.time < start || marker.time >= end).map((marker) => ({ ...marker, time: map(marker.time) })),
      beatAnalysis: undefined,
      subtitles: next.timeline.subtitles.flatMap((cue) => {
        const duration = map(cue.endTime) - map(cue.startTime);
        return duration > 0 ? [{ ...cue, startTime: map(cue.startTime), endTime: map(cue.endTime), words: cue.words?.flatMap((word) => {
          const duration = map(word.endTime) - map(word.startTime);
          return duration > 0 ? [{ ...word, startTime: map(word.startTime), endTime: map(word.endTime) }] : [];
        }) }] : [];
      }) } };
}
