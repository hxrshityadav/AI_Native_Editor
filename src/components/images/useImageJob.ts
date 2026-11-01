"use client";
import { useEffect, useRef, useState } from "react";
import { runImageTask } from "@/lib/images/client";
import { validateDimensions, type ImageFormat } from "@/lib/images/policy";
import type { ImageInfo, ImageOutput } from "@/lib/images/engine";

export type ImageRequest = { width: number; height: number; quality: number; format: ImageFormat; targetBytes?: number; background: string };

/**
 * File, inspection and processing state shared by the photo tools. The worker calls, validation, cancellation and
 * error messages are the same ones the tools used before; each tool only builds its own request.
 */
export function useImageJob() {
  const [file, setFile] = useState<File>();
  const [info, setInfo] = useState<ImageInfo>();
  const [result, setResult] = useState<ImageOutput>();
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  const invalidate = () => { setResult(undefined); setError(""); setNotice(""); };
  function reset() { active.current?.abort(); active.current = null; setBusy(""); setFile(undefined); setInfo(undefined); invalidate(); }
  function cancel() { active.current?.abort(); active.current = null; setBusy(""); setNotice("Operation cancelled. Choose an image or try again."); }
  async function load(files: FileList | File[], onLoaded: (image: ImageInfo) => void) {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setFile(undefined); setInfo(undefined); invalidate();
    if (files.length !== 1) { setBusy(""); setError("Choose one image at a time using the file picker or drop area."); return; }
    // FileList is live: resetting the picker must not clear an in-flight selection.
    const selected = files[0];
    setBusy("Reading and checking the image…");
    try {
      const image = await runImageTask({ kind: "inspect", file: selected }, controller.signal) as ImageInfo;
      if (controller.signal.aborted) return;
      setFile(selected); setInfo(image); onLoaded(image);
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Cannot open this image. Choose another file."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }
  /** `build` may throw a user-facing validation error before any work starts. */
  async function run(build: (image: ImageInfo) => ImageRequest, status: string) {
    if (!file || !info) return;
    invalidate(); const controller = new AbortController(); active.current?.abort(); active.current = controller;
    try {
      const request = build(info);
      validateDimensions(request.width, request.height);
      setBusy(status);
      const output = await runImageTask({ kind: "process", file, ...request }, controller.signal) as ImageOutput;
      if (!controller.signal.aborted) setResult(output);
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not process this image. Try smaller dimensions or another format."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }
  return { file, info, result, busy, error, notice, load, run, cancel, reset, invalidate };
}
