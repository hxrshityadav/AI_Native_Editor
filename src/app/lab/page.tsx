import type { Metadata } from "next";
import { LabClient } from "./LabClient";

export const metadata: Metadata = {
  title: "Render lab · Reel Finisher",
  robots: { index: false },
};

export default function LabPage() {
  return <LabClient />;
}
