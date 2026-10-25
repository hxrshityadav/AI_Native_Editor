import type { Animation } from "../editor/project";

export const ANIMATIONS = [
  { id: "none", name: "No animation", description: "Still, fully readable captions." },
  { id: "fade", name: "Fade in", description: "A soft caption-block entrance." },
  { id: "slide", name: "Slide up", description: "Captions settle upward into place." },
  { id: "scale", name: "Scale in", description: "A restrained block zoom." },
  { id: "pop", name: "Word pop", description: "The spoken word pulses on its own timing." },
  { id: "bounce", name: "Bounce", description: "A small, damped block bounce." },
  { id: "typewriter", name: "Typewriter", description: "Letters reveal inside each word's timing." },
  { id: "reveal", name: "Word reveal", description: "Each word appears as it is spoken." },
] as const;
export function animationFrame(animation: Animation | undefined, time: number, start: number, end: number) {
  const a = animation ?? { effect: "none", duration: 0.25, intensity: 0.5 };
  const duration = Math.max(0.001, Math.min(a.duration, end - start));
  const progress = Math.max(0, Math.min(1, (time - start) / duration));
  const remaining = 1 - progress;
  return { opacity: a.effect === "fade" ? progress : 1,
    scale: a.effect === "scale" ? 1 - 0.25 * a.intensity * remaining : 1,
    y: a.effect === "slide" ? 0.06 * a.intensity * remaining
      : a.effect === "bounce" ? -0.04 * a.intensity * Math.sin(progress * Math.PI * 3) * remaining : 0 };
}
