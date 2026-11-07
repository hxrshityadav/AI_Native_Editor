import { availableTools, type ToolCategory } from "@/lib/tools/catalog";

// Several catalog entries open Studio. A command points to a destination once.
export const commandTools = availableTools.filter(tool => tool.href !== "/studio" || tool.title === "Reel Studio");
export const QUICK_ACTIONS = ["image-compressor", "image-resizer", "image-converter", "video-compressor", "trim-video", "extract-audio", "audio-converter", "text-to-speech", "noise-remover", "shorts-maker"].map(slug => commandTools.find(tool => tool.href === `/tools/${slug}`)!);
export const toolByHref = new Map(commandTools.map(tool => [tool.href!, tool]));
export type CategoryFilter = ToolCategory | "all";

export function searchTools(query: string, category: CategoryFilter = "all") {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return commandTools.filter(tool => (category === "all" || tool.category === category) && words.every(word => `${tool.title} ${tool.navLabel} ${tool.summary} ${tool.formats.join(" ")}`.toLowerCase().includes(word)));
}
