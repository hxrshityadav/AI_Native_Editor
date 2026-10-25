"use client"; // Error boundaries must be Client Components

import { ErrorScreen } from "@/components/editor/ErrorScreen";

export default function Error(props: { error: unknown; retry: () => void }) {
  return <ErrorScreen {...props} />;
}
