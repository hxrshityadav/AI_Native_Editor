import type { Metadata } from "next";
import { EditorHost } from "./EditorHost";

export const metadata: Metadata = {
  title: "Studio · Reel Finisher",
  description: "Caption a talking-head video in Hinglish, Hindi or English. Your video stays on this device.",
};

export default function StudioPage() {
  return <EditorHost />;
}
