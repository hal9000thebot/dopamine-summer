import type { Channel } from "@/lib/types";

export function formatPostForChannel(content: string, channel: Channel) {
  const trimmed = content.trim();

  if (channel !== "x") {
    return trimmed;
  }

  return splitIntoSentences(trimmed).join("\n");
}

function splitIntoSentences(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    const sentences = Array.from(segmenter.segment(normalized), (segment) => segment.segment.trim()).filter(Boolean);

    if (sentences.length > 0) {
      return sentences;
    }
  }

  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}
