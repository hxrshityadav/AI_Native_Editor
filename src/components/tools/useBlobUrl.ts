"use client";
import { useEffect, useState } from "react";
export function useBlobUrl(blob?: Blob) {
  const [value, setValue] = useState<{ blob: Blob; url: string }>();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Allocate browser resources after commit and revoke on replacement/unmount.
  useEffect(() => { if (!blob) { setValue(undefined); return; } const url = URL.createObjectURL(blob); setValue({ blob, url }); return () => URL.revokeObjectURL(url); }, [blob]);
  return value?.blob === blob ? value.url : "";
}
