export const CAPTION_PRESETS = [
  { name: "Clean Minimal", styleId: "clean", appearance: { strokeRatio: 0.08, highlightEnabled: false }, effect: "fade" },
  { name: "Bold Creator", styleId: "bold-yellow", appearance: { fontSizeRatio: 0.06 }, effect: "pop" },
  { name: "Podcast", styleId: "boxed", appearance: { maxWidthRatio: 0.9, lineSpacing: 1.5 }, effect: "none" },
  { name: "Karaoke Highlight", styleId: "pop", appearance: { highlightEnabled: true }, effect: "none" },
  { name: "Editorial", styleId: "subtitle", appearance: { font: "asset:notoserif", weight: 600, boxOpacity: 0.7, boxColor: "#141414" }, effect: "fade" },
  { name: "High Contrast", styleId: "boxed", appearance: { textColor: "#FFFFFF", boxColor: "#000000", boxOpacity: 1 }, effect: "none" },
  { name: "Gaming", styleId: "bold-yellow", appearance: { textColor: "#75FF88", strokeRatio: 0.2, transform: "uppercase" }, effect: "bounce" },
  { name: "Cinematic", styleId: "subtitle", appearance: { font: "asset:notoserif", weight: 400, letterSpacing: 0.08, highlightEnabled: false }, effect: "fade" },
  { name: "Educational", styleId: "clean", appearance: { textColor: "#FFFFFF", boxColor: "#10243A", boxOpacity: 0.9 }, effect: "reveal" },
] as const;
